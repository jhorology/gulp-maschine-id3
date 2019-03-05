msgpack = require 'msgpack-lite'

NKS = 'com.native-instruments.nks.soundinfo\u0000'
NISOUND = 'com.native-instruments.nisound.soundinfo\u0000'
UNKNOWN0 = '020000000100000000000000'
UNKNOWN1 = '00000000ffffffffffffffff00000000000000000000000000000000'
UNKNOWN2 = '01000000'
UNKNOWN3 = '00000000'
offset = 0


module.exports =
  ###
  is ID3v2 frame nks.soundinfo
  ###
  isFrameNKS: (frame) ->
    frame and frame.id = 'GEOB' and frame.size > NKS.length + 3 and
      (frame.content.slice 3, 3 + NKS.length).toString() is NKS

  ###
  is ID3v2 frame nisound.soundinfo
  ###
  isFrameNISound: (frame) ->
    frame and frame.id = 'GEOB' and frame.size > NISOUND.length + 3 and
      (frame.content.slice 3, 3 + NISOUND.length).toString() is NISOUND

  decodeNKS: (frame) ->
    msgpack.decode frame.content.slice 3 + NKS.length

  decodeNI: (frame) ->
    offset = 3 + NISOUND.length
    # unknown0 '020000000100000000000000'
    unknown0: @readUnknwon frame.content, 'unknown0', UNKNOWN0
    name: @readUcs2String frame.content
    author: @readUcs2String frame.content
    vendor: @readUcs2String frame.content
    comment: @readUcs2String frame.content
    unknown1: @readUnknwon frame.content, 'unknown1', UNKNOWN1
    flag: @readUInt32 frame.content
    unknown2: @readUnknwon frame.content, 'unknown2', UNKNOWN2
    bankchain: @readUcs2StringArray frame.content
    types: @readUcs2StringArray frame.content
    unknown3: @readUnknwon frame.content, 'unknown3', UNKNOWN3
    props: @readKeyValuePairs frame.content
    remain: frame.content.slice offset

  readUnknwon: (content, name, expect) ->
    l = expect.length >> 1
    v = content.toString 'hex', offset, offset + l
    offset += l
    unless v is expect
      console.warn "unmatch #{name} [#{expect}]'. occurs:#{v}'"
    v

  readUcs2String: (content) ->
    length = (content.readUInt32LE offset) << 1
    offset += 4
    if length
      s = content.toString 'ucs2', offset, offset + length
      offset += length
      s
    else
      ''

  readUcs2StringArray: (content) ->
    size = content.readUInt32LE offset
    offset += 4
    for i in [0...size]
      @readUcs2String content

  readKeyValuePairs: (content) ->
    pairs = []
    size = content.readUInt32LE offset
    offset += 4
    for i in [0...size]
      key = @readUcs2String content
      value = @readUcs2String content
      [key, value]

  readUInt32: (content) ->
    v = content.readUInt32LE offset
    offset += 4
    v
