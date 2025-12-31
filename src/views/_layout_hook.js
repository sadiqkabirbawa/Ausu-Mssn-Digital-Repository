const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

module.exports = function layoutMiddleware(req, res, next) {
  if (!res.locals.messages) {
    res.locals.messages = { error: req.flash('error'), success: req.flash('success') };
  }

  const _render = res.render.bind(res);

  res.render = function (view, options = {}, callback) {
    options.layout = (n) => { options._layout = n; };

    return _render(view, options, function (err, html) {
      if (err) return callback ? callback(err) : next(err);

      const layoutFile = path.join(res.app.get('views'), (options._layout || 'layout') + '.ejs');

      fs.readFile(layoutFile, 'utf8', (err2, layoutTpl) => {
        if (err2) {
          return res.send(html);
        }
        const rendered = ejs.render(
          layoutTpl,
          Object.assign({}, res.locals, options, { body: html }),
          { filename: layoutFile }
        );
        res.send(rendered);
      });
    });
  };

  next();
};
