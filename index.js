const url = require('url')
const fs = require('fs')
const WatchMerged = require('tre-prototypes')
const {isMsg} = require('ssb-ref')

function awaitStable(ssb, bootKey, cb) {
  const watchMerged = WatchMerged(ssb)

  const bootObs = watchMerged(boot)
  let timer, release
  release = watch(bootObs, kv => {
    if (!kv) return
    console.log(kv)
    if (timer) clearTimeout(timer)
    timer = setTimeout( ()=> {
      const blob = kv.value.content.codeBlob
      const url = blob && `/blobs/get/${encodeURIComponent(blob)}`
      release()
      cb(url ? null : new Error('malformed boot message: ' + kv.key), url)
    }, 400)
  })
}

exports.name = 'tre-boot'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  console.log('tre-boot', config.ws.port)

  ssb.ws.use(function (req, res, next) {
    if(!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = url.parse('http://makeurlparseright.com'+req.url)
    if (u.pathname.startsWith('/boot')) {
      const bootKey = decodeURIComponent(u.pathname.slice(6)) || config.boot
      if (!isMsg(bootKey)) {
        return res.end('Bad Request: Invalid boot message id syntax: ' + bootKey, 400)
      }
      awaitStable(ssb, bootKey, (err, url) => {
        if (err) return res.end(err.message, 503)
        res.setHeader('Location', url)
        res.end('Current revision at ' + url, 307)
      })
      return
    }
    next()
  })
}
