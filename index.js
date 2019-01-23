const url = require('url')
const fs = require('fs')
const WatchMerged = require('tre-prototypes')
const WatchHeads = require('tre-watch-heads')
const Value = require('mutant/value')
const watch = require('mutant/watch')
const {isMsg} = require('ssb-ref')
const debug = require('debug')('tre-boot')

function awaitStable(ssb, bootKey, cb) {
  const watchMerged = WatchMerged(ssb)
  const watchHeads = WatchHeads(ssb)

  debug(`bootKey: "${bootKey}"`)

  // first let's find out if bootKey refers to a specific revision
  // or a revisionRoot.
  // revisions.get() will wait for the message to arrive via gossip
  ssb.revisions.get(bootKey, {meta: true}, (err, {meta, value}) => {
    if (err) return cb(err)
    let kvObs
    if (!meta.original) {
      // it's a specific revision
      // but we still use the latest prototypes!
      debug('request for specific revision')
      kvObs = Value({key: bootKey, value}) // this won't change
    } else {
      debug('boot: request for latest revision')
      // watch this revisionRoot
      kvObs = watchHeads(bootKey)
    }
    let timer, release
    release = watch(watchMerged(kvObs), kv => {
      if (!kv) return
      debug('Boot message changed, revision is %s', kv.key)
      if (timer) clearTimeout(timer)
      timer = setTimeout( ()=> {
        const blob = kv.value.content.codeBlob
        const url = blob && `/blobs/get/${encodeURIComponent(blob)}?contentType=${encodeURIComponent('text/html')}`
        release()
        debug('boot message seems to have settled, booting ....')
        cb(url ? null : new Error('malformed boot message: ' + kv.key), url)
      }, 1000)
    })
  })
}

exports.name = 'tre-boot'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  debug('ws port is %d', config.ws.port)

  ssb.ws.use(function (req, res, next) {
    if(!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = url.parse('http://makeurlparseright.com'+req.url)
    if (u.pathname.startsWith('/boot')) {
      debug('request to boot: %s', req.url)
      const bootKey = decodeURIComponent(u.pathname.slice(6)) || config.boot
      if (!isMsg(bootKey)) {
        debug('malformed /boot request: %s', req.url)
        res.statusCode = 400
        return res.end('Bad Request: Invalid boot message id syntax: ' + bootKey)
      }
      awaitStable(ssb, bootKey, (err, url) => {
        if (err) {
          res.statusCode = 503
          debug('error retrieving boot message: %s', err.message)
          return res.end(err.message, 503)
        }
        debug('redirecting to: %s', url)
        res.statusCode = 307
        res.setHeader('Location', url)
        res.setHeader(
          'Set-Cookie',
          `bootKey=${bootKey}; Path=/.trerc; SameSite=Strict`
        )
        res.end('Current revision at ' + url)
      })
      return
    }
    next()
  })
}
