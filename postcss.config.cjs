const postcssJitProps = require('postcss-jit-props');
const postcssCustomMedia = require('postcss-custom-media');
const OpenProps = require('open-props');

module.exports = {
  plugins: [
    postcssCustomMedia(),
    postcssJitProps(OpenProps),
  ]
}