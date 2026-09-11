require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const { z } = require('zod');
const { read, write } = require('./store');
const { token, requireAuth, bcrypt } = require('./auth');
const { generateKit } = require('./pipeline');
const { validateKit } = require('./kit');

const app = express();

/*
 * CORS
 *
 * In production, allow the Vercel frontend.
 * origin: true also handles Vercel preview URLs without rejecting them.
 */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));

/* Validation schemas */
const auth = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const input = z.object({
  jd: z.string().min(1).max(100000),
  company_url: z.string().url(),
  days: z.number().int().min(1).max(60),
});

/* Error helper */
const error = (res, status, code, message) =>
  res.status(status).json({
    error: {
      code,
      message,
    },
  });

/* =========================
   AUTH - REGISTER
   ========================= */

app.post('/api/auth/register', async (req, res) => {
  try {
    const v = auth.safeParse(req.body);

    if (!v.success) {
      return error(
        res,
        400,
        'VALIDATION',
        'Use a valid email and 8+ character password.'
      );
    }

    const state = await read();

    if (state.users.some((u) => u.email === v.data.email)) {
      return error(
        res,
        409,
        'EMAIL_EXISTS',
        'An account already exists for that email.'
      );
    }

    const user = {
      id: crypto.randomUUID(),
      email: v.data.email,
      password: await bcrypt.hash(v.data.password, 12),
    };

    state.users.push(user);

    await write(state);

    return res.status(201).json({
      token: token(user),
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return error(
      res,
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Could not save your account.'
    );
  }
});

/* =========================
   AUTH - LOGIN
   ========================= */

app.post('/api/auth/login', async (req, res) => {
  try {
    const v = auth.safeParse(req.body);
    const state = await read();

    const user =
      v.success &&
      state.users.find((u) => u.email === v.data.email);

    if (
      !user ||
      !(await bcrypt.compare(v.data.password, user.password))
    ) {
      return error(
        res,
        401,
        'INVALID_CREDENTIALS',
        'Email or password is incorrect.'
      );
    }

    return res.json({
      token: token(user),
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    return error(
      res,
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Could not read your account.'
    );
  }
});

/* =========================
   GET KITS
   ========================= */

app.get('/api/kits', requireAuth, async (req, res) => {
  try {
    const state = await read();

    return res.json(
      state.kits.filter(
        (k) => k.user_id === req.user.sub
      )
    );
  } catch (err) {
    return error(
      res,
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Could not load kits.'
    );
  }
});

/* =========================
   CREATE KIT
   ========================= */

app.post('/api/kits', requireAuth, async (req, res) => {
  const v = input.safeParse(req.body);

  if (!v.success) {
    return error(
      res,
      400,
      'VALIDATION',
      'Provide a job description, valid company URL, and 1–60 days.'
    );
  }

  try {
    const kit = await generateKit(v.data);
    const state = await read();

    const entry = {
      id: crypto.randomUUID(),
      user_id: req.user.sub,
      kit,
      request: v.data,
      created_at: new Date().toISOString(),
    };

    state.kits.push(entry);

    await write(state);

    return res.status(201).json(entry);
  } catch (e) {
    return error(
      res,
      502,
      e.code || 'GENERATION_FAILED',
      e.message
    );
  }
});

/* =========================
   UPDATE KIT
   ========================= */

app.put('/api/kits/:id', requireAuth, async (req, res) => {
  try {
    const state = await read();

    const entry = state.kits.find(
      (k) =>
        k.id === req.params.id &&
        k.user_id === req.user.sub
    );

    if (!entry) {
      return error(
        res,
        404,
        'NOT_FOUND',
        'Kit not found.'
      );
    }

    const valid = validateKit(req.body.kit);

    if (!valid.ok) {
      return error(
        res,
        400,
        'INVALID_KIT',
        JSON.stringify(valid.error)
      );
    }

    entry.kit = req.body.kit;
    entry.updated_at = new Date().toISOString();

    await write(state);

    return res.json(entry);
  } catch (err) {
    return error(
      res,
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Could not save this kit.'
    );
  }
});

/* =========================
   REGENERATE KIT SECTION
   ========================= */

app.post(
  '/api/kits/:id/regenerate',
  requireAuth,
  async (req, res) => {
    try {
      const state = await read();

      const entry = state.kits.find(
        (k) =>
          k.id === req.params.id &&
          k.user_id === req.user.sub
      );

      const section = req.body.section;

      if (!entry) {
        return error(
          res,
          404,
          'NOT_FOUND',
          'Kit not found.'
        );
      }

      if (!entry.request) {
        return error(
          res,
          409,
          'NO_SOURCE',
          'This legacy kit cannot be regenerated.'
        );
      }

      const fresh = await generateKit(entry.request);

      if (section === 'brief') {
        entry.kit.company_brief =
          fresh.company_brief;
      } else if (section === 'schedule') {
        entry.kit.schedule = fresh.schedule;
      } else if (
        [
          'technical',
          'behavioural',
          'system-design',
          'company-fit',
        ].includes(section)
      ) {
        const saved = entry.kit.questions.filter(
          (q) =>
            q.category !== section ||
            q.state === 'edited' ||
            q.state === 'pinned'
        );

        entry.kit.questions = [
          ...saved,
          ...fresh.questions.filter(
            (q) => q.category === section
          ),
        ];
      } else {
        return error(
          res,
          400,
          'VALIDATION',
          'Unknown section.'
        );
      }

      entry.updated_at = new Date().toISOString();

      await write(state);

      return res.json(entry);
    } catch (e) {
      return error(
        res,
        502,
        e.code || 'REGENERATION_FAILED',
        e.message
      );
    }
  }
);

/* =========================
   HEALTH CHECK
   ========================= */

const health = async (_, res) => {
  try {
    await read();

    return res.json({
      ok: true,
      persistence: process.env.MONGODB_URI
        ? 'mongodb'
        : 'local',
    });
  } catch (err) {
    return error(
      res,
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Database unavailable.'
    );
  }
};

app.get('/health', health);
app.get('/api/health', health);

/* =========================
   START SERVER
   ========================= */

if (require.main === module) {
  app.listen(
    process.env.PORT || 4000,
    () => console.log('API ready')
  );
}

module.exports = app;