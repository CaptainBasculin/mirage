import randomstring from 'randomstring'
import FlakeId from 'flake-idgen'
import uuid from 'uuid/v4'
const idGen = new FlakeId({
  datacenter: 0,
  worker: 0
})

const invisibleCharset = ['\u200B', '\u2060', '\u180E', '\u200D', '\u200C']

export function randomImageId(secure = false) {
  return randomstring.generate({
    length: secure ? 16 : 7,
    charset: 'AaBbCcDdEeFf1234567890'
  })
}
export function randomInvisibleId(secure = false) {
  return (
    randomstring.generate({
      length: 18,
      charset: invisibleCharset.join('')
    }) + '\u200B'
  )
}
export function randomUserId() {
  let buf = idGen.next()
  let uint = buf.readBigUInt64BE(0)
  return uint.toString()
}
export function randomKey() {
  return uuid()
}
