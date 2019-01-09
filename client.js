const {client} = require('tre-client')
const watch = require('mutant/watch')
const h = require('mutant/html-element')
const WatchMerged = require('tre-prototypes')

client( (err, ssb, config) => {
  if (err) throw err
  const watchMerged = WatchMerged(ssb)

  const boot = document.querySelector('.boot-msg').innerText
  if (!boot) {
    console.error('No boot message')
  }
  const bootObs = watchMerged(boot)
  let timer
  watch(bootObs, kv => {
    if (!kv) return
    console.log(kv)
    if (timer) clearTimeout(timer)
    timer = setTimeout( ()=> {
      const blob = kv.value.content.codeBlob
      document.body.innerHTML = ""
      document.body.appendChild(h('script', {
        src: `/blobs/get/${encodeURIComponent(blob)}`
      }))
    }, 400)
  })
})
