/** Keep production builds from overwriting the active development Webpack cache. */
module.exports = {
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev'
};
