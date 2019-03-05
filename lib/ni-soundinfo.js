(function() {
  var NISOUND, NKS, UNKNOWN0, UNKNOWN1, UNKNOWN2, UNKNOWN3, msgpack, offset;

  msgpack = require('msgpack-lite');

  NKS = 'com.native-instruments.nks.soundinfo\u0000';

  NISOUND = 'com.native-instruments.nisound.soundinfo\u0000';

  UNKNOWN0 = '020000000100000000000000';

  UNKNOWN1 = '00000000ffffffffffffffff00000000000000000000000000000000';

  UNKNOWN2 = '01000000';

  UNKNOWN3 = '00000000';

  offset = 0;

  module.exports = {
    /*
    is ID3v2 frame nks.soundinfo
    */
    isFrameNKS: function(frame) {
      return frame && (frame.id = 'GEOB' && frame.size > NKS.length + 3 && (frame.content.slice(3, 3 + NKS.length)).toString() === NKS);
    },
    /*
    is ID3v2 frame nisound.soundinfo
    */
    isFrameNISound: function(frame) {
      return frame && (frame.id = 'GEOB' && frame.size > NISOUND.length + 3 && (frame.content.slice(3, 3 + NISOUND.length)).toString() === NISOUND);
    },
    decodeNKS: function(frame) {
      return msgpack.decode(frame.content.slice(3 + NKS.length));
    },
    decodeNI: function(frame) {
      offset = 3 + NISOUND.length;
      return {
        // unknown0 '020000000100000000000000'
        unknown0: this.readUnknwon(frame.content, 'unknown0', UNKNOWN0),
        name: this.readUcs2String(frame.content),
        author: this.readUcs2String(frame.content),
        vendor: this.readUcs2String(frame.content),
        comment: this.readUcs2String(frame.content),
        unknown1: this.readUnknwon(frame.content, 'unknown1', UNKNOWN1),
        flag: this.readUInt32(frame.content),
        unknown2: this.readUnknwon(frame.content, 'unknown2', UNKNOWN2),
        bankchain: this.readUcs2StringArray(frame.content),
        types: this.readUcs2StringArray(frame.content),
        unknown3: this.readUnknwon(frame.content, 'unknown3', UNKNOWN3),
        props: this.readKeyValuePairs(frame.content),
        remain: frame.content.slice(offset)
      };
    },
    readUnknwon: function(content, name, expect) {
      var l, v;
      l = expect.length >> 1;
      v = content.toString('hex', offset, offset + l);
      offset += l;
      if (v !== expect) {
        console.warn(`unmatch ${name} [${expect}]'. occurs:${v}'`);
      }
      return v;
    },
    readUcs2String: function(content) {
      var length, s;
      length = (content.readUInt32LE(offset)) << 1;
      offset += 4;
      if (length) {
        s = content.toString('ucs2', offset, offset + length);
        offset += length;
        return s;
      } else {
        return '';
      }
    },
    readUcs2StringArray: function(content) {
      var i, j, ref, results, size;
      size = content.readUInt32LE(offset);
      offset += 4;
      results = [];
      for (i = j = 0, ref = size; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
        results.push(this.readUcs2String(content));
      }
      return results;
    },
    readKeyValuePairs: function(content) {
      var i, j, key, pairs, ref, results, size, value;
      pairs = [];
      size = content.readUInt32LE(offset);
      offset += 4;
      results = [];
      for (i = j = 0, ref = size; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
        key = this.readUcs2String(content);
        value = this.readUcs2String(content);
        results.push([key, value]);
      }
      return results;
    },
    readUInt32: function(content) {
      var v;
      v = content.readUInt32LE(offset);
      offset += 4;
      return v;
    }
  };

}).call(this);
