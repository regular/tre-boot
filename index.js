const url = require('url')
const fs = require('fs')
const WatchMerged = require('tre-prototypes')
const WatchHeads = require('tre-watch-heads')
const watch = require('mutant/watch')
const {isMsg} = require('ssb-ref')

function awaitStable(ssb, bootKey, cb) {
  const watchMerged = WatchMerged(ssb)
  const watchHeads = WatchHeads(ssb)

  console.log(`bootKey: "${bootKey}"`)

  // first let's find out if bootKey refers to a specific revision
  // or a revisionRoot.
  ssb.get(bootKey, (err, value) => {
    if (err) return cb(err)
    const content = value.content
    const revBranch = content.revisionBranch
    let kvObs
    if (revBranch && revBranch !== kv.key) {
      // it's a specific revision
      // but we still use the latest prototypes!
      console.log('request for specific revision')
      kvObs = Value({key: bootKey, value}) // this won't change
    } else {
      console.log('request for latest revision')
      // watch this revisionRoot
      kvObs = watchHeads(bootKey)
    }
    let timer, release
    release = watch(watchMerged(kvObs), kv => {
      if (!kv) return
      console.log(kv.key)
      if (timer) clearTimeout(timer)
      timer = setTimeout( ()=> {
        const blob = kv.value.content.codeBlob
        const url = blob && `/blobs/get/${encodeURIComponent(blob)}?contentType=${encodeURIComponent('text/html')}`
        release()
        cb(url ? null : new Error('malformed boot message: ' + kv.key), url)
      }, 400)
    })
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
        res.statusCode = 400
        return res.end('Bad Request: Invalid boot message id syntax: ' + bootKey)
      }
      awaitStable(ssb, bootKey, (err, url) => {
        if (err) {
          res.statusCode = 503
          return res.end(err.message, 503)
        }
        res.statusCode = 307
        res.setHeader('Location', url)
        res.end('Current revision at ' + url)
      })
      return
    }
    next()
  })
}
