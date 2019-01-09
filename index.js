const url = require('url')
const fs = require('fs')
const Trumpet = require('trumpet')
const Browserify = require('browserify')

exports.name = 'tre-boot'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  console.log('tre-boot', config.ws.port)

  ssb.ws.use(function (req, res, next) {
    if(!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = url.parse('http://makeurlparseright.com'+req.url)
    if (u.pathname == '/boot') {
      res.setHeader('Content-Type', 'text/html')

      const trumpet = Trumpet()
      trumpet.pipe(res)
       
      const bootMsg = trumpet.select('.boot-msg').createWriteStream()
      bootMsg.end(`${config.boot}`)

      const bootCode = trumpet.select('.boot-code').createWriteStream()
      const browserify = Browserify()
      browserify.add(__dirname + '/client.js')
      browserify.bundle().pipe(bootCode)

      fs.createReadStream(__dirname + '/boot.html').pipe(trumpet)
      return
    }
    next()
  })
}
