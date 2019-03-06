(function() {
  /*
  Gulp plugin for adding maschine metadata to wav file

  - API
   - id3(data)
    - data
      object or function to provide data
    - data.name          String Optional default: source filename
    - data.author        String
    - data.vendor        String
    - data.comment       String
    - data.deviceType    String 'LOOP' or 'ONESHOT'
    - data.bankchain     Array of String
    - data.types         2 dimensional Array of String
    - data.modes         Array of String
    - data.syncFilename  bool - use data.name as filenam. default: true
    - data.removeUnnecessaryChunks bool - remove all chunks except 'fmt ' or 'data' chunk. default: true
    - function(file, chunks[,callback])
      function to provide data
      - file instance of vinyl file
      - chunks Array of object
         RIFF chunks of source file
         element properties
           - id    String chunk id
           - data  Buffer contents of chunk
      - callback function(err, data)
        callback function to support non-blocking call.

  - Usage
      id3 = require 'gulp-maschine-id3'
      gulp.task 'hoge', ->
        gulp.src ["*.wav"]
          .pipe id3 (file, chunks) ->
            name: "Hogehoge"
            vendor: "Hahaha"
            author: "Hehehe"
            bankchain: ['Fugafuga', 'Fugafuga 1.1 Library']
            comment: "uniuni"
            deviceType: 'LOOP'
            types: [
              ['Bass', 'Synth Bass']
            ]
            modes: ['Additive', 'Analog']
          .pipe gulp.dest "dist"
  */
  var BufferBuilder, DEFAULT_NKS, PLUGIN_NAME, _, _build_id3_chunk, _build_nisound_frame, _build_nks_frame, _id3, _modesAndTypes, _parseSourceWavChunks, _validate, assert, gutil, msgpack, path, riffBuilder, riffReader, through,
    indexOf = [].indexOf;

  assert = require('assert');

  path = require('path');

  through = require('through2');

  gutil = require('gulp-util');

  _ = require('underscore');

  msgpack = require('msgpack-lite');

  riffReader = require('riff-reader');

  riffBuilder = require('./riff-builder');

  PLUGIN_NAME = 'maschine-id3';

  DEFAULT_NKS = {
    __ni_internal: {
      source: 'other'
    },
    author: '',
    bankchain: '',
    comment: '',
    deviceType: 'ONESHOT',
    modes: [],
    name: '',
    tempo: 0,
    types: [],
    vendor: ''
  };

  module.exports = function(data) {
    return through.obj(function(file, enc, cb) {
      var alreadyCalled, chunks, error, id3, providedData;
      alreadyCalled = false;
      id3 = (err, data) => {
        var error;
        if (alreadyCalled) {
          this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'duplicate callback calls.'));
          return;
        }
        alreadyCalled = true;
        if (err) {
          this.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
          return cb();
        }
        try {
          if (data) {
            _id3(file, data);
          }
          this.push(file);
        } catch (error1) {
          error = error1;
          this.emit('error', new gutil.PluginError(PLUGIN_NAME, error));
        }
        return cb();
      };
      if (!file) {
        id3('Files can not be empty');
        return;
      }
      if (file.isStream()) {
        id3('Streaming not supported');
        return;
      }
      if (_.isFunction(data)) {
        try {
          chunks = _parseSourceWavChunks(file);
          providedData = data.call(this, file, chunks, id3);
        } catch (error1) {
          error = error1;
          id3(error);
        }
        if (data.length <= 2) {
          return id3(void 0, providedData);
        }
      } else {
        try {
          _parseSourceWavChunks(file);
        } catch (error1) {
          error = error1;
          return error;
        }
        return id3(void 0, data);
      }
    });
  };

  // replace or append ID3 chunk to file

  // @data    object  - metadata
  // @wreturn Array   - chunks in source file
  // ---------------------------------
  _parseSourceWavChunks = function(file) {
    var chunks, ids, json, src;
    chunks = [];
    src = file.isBuffer() ? file.contents : file.path;
    json = void 0;
    riffReader(src, 'WAVE').readSync(function(id, data) {
      return chunks.push({
        id: id,
        data: data
      });
    });
    ids = chunks.map(function(chunk) {
      return chunk.id;
    });
    assert.ok((indexOf.call(ids, 'fmt ') >= 0), '[fmt ] chunk is not contained in file.');
    assert.ok((indexOf.call(ids, 'data') >= 0), '[data] chunk is not contained in file.');
    return file.chunks = chunks;
  };

  // replace or append ID3 chunk to file

  // @data    Object - metadata
  // @wreturn Buffer - contents of ID3 chunk
  // ---------------------------------
  _id3 = function(file, data) {
    var basename, chunk, chunks, dirname, extname, j, len, wav;
    extname = path.extname(file.path);
    basename = path.basename(file.path, extname);
    dirname = path.dirname(file.path);
    // default options
    data = _.defaults(data, {
      name: basename,
      syncFilename: true,
      removeUnnecessaryChunks: true
    });
    // validate
    _validate(data);
    chunks = data.removeUnnecessaryChunks ? file.chunks.filter(function(c) {
      var ref;
      return (ref = c.id) === 'fmt ' || ref === 'data';
    // remove 'ID3 ' chunk if already exits.
    }) : file.chunks.filter(function(c) {
      return c.id !== 'ID3 ';
    });
    // rename
    if (data.syncFilename) {
      file.path = path.join(dirname, data.name + extname);
    }
    // build wav file
    wav = riffBuilder('WAVE');
    for (j = 0, len = chunks.length; j < len; j++) {
      chunk = chunks[j];
      wav.pushChunk(chunk.id, chunk.data);
    }
    wav.pushChunk('ID3 ', _build_id3_chunk(data));
    return file.contents = wav.buffer();
  };

  // build ID3 chunk contents

  // @data    Object - metadata
  // @wreturn Buffer - contents of ID3 chunk
  // ---------------------------------
  _build_id3_chunk = function(data) {
    var id3Header, nisoundFrame, nksFrame;
    nksFrame = _build_nks_frame(data);
    nisoundFrame = _build_nisound_frame(data);
    id3Header = new BufferBuilder().push('ID3').push([ // magic
      0x04,
      0x00 // id3 version 4 -> 2.4.0
    // size id3header + nksFrame + nisoundFrame + padding 1024
    ]).push(0x00).pushSyncsafeInt(nksFrame.length + nisoundFrame.length + 1024); // flags
    // return buffer
    return Buffer.concat([
      id3Header.buf, // ID3v2 header 10 byte
      nisoundFrame, // GEOB frame
      nksFrame, // GEOB frame
      Buffer.alloc(1024,
      0) // padding 1024byte
    ]);
  };

  // build ID3 nisound GEOB frame

  // @data    Object - metadata
  // @wreturn Buffer - contents of GEOB frame
  // ---------------------------------
  _build_nisound_frame = function(data) {
    var contents, frameHeader;
    // unknown, It seems all expansions sample are same.
    // unknown, It seems all expansions sample are same.
    // sample name
    // author name
    // vendor name
    // comment
    // unknown, It seems all expansions sample are same.
    // ??
    // .pushUInt32LE 0
    // unknown
    // bankchain
    // types (category)
    // maybe modes ?
    // .pushUcs2StringArray data.modes
    // properties, It seems all expansions sample are same.
    contents = new BufferBuilder().pushHex('000000').push('com.native-instruments.nisound.soundinfo\u0000').pushHex('020000000100000000000000').pushUcs2String(data.name).pushUcs2String(data.author).pushUcs2String(data.vendor).pushUcs2String(data.comment).pushHex('00000000ffffffffffffffff00000000000000000000000000000000').pushUInt32LE(data.deviceType === 'LOOP' ? 4 : 3).pushHex('01000000').pushUcs2StringArray(data.bankchain).pushUcs2StringArray(_modesAndTypes(data.modes, data.types)).pushHex('00000000').pushKeyValuePairs([['color', '0'], ['devicetypeflags', data.deviceType === 'LOOP' ? '8' : '4'], ['soundtype', '0'], ['tempo', '0'], ['verl', '1.7.14'], ['verm', '1.7.14'], ['visib', '0']]);
    // header
    frameHeader = new BufferBuilder().push('GEOB').pushSyncsafeInt(contents.buf.length).push([ // frame Id // data size
      0x00,
      0x00 // flags
    ]);
    // return buffer
    return Buffer.concat([frameHeader.buf, contents.buf]);
  };

  // build ID3 nisound GEOB frame

  // @data    Object - metadata
  // @wreturn Buffer - contents of GEOB frame
  // ---------------------------------
  _build_nks_frame = function(data) {
    var content, dataKeys, frameHeader, nks, nksHeader;
    nks = Object.assign({}, DEFAULT_NKS);
    dataKeys = Object.keys(data);
    (Object.keys(nks)).forEach(function(key) {
      if (dataKeys.includes(key)) {
        return nks[key] = data[key];
      }
    });
    nksHeader = new BufferBuilder().pushHex('000000').push('com.native-instruments.nks.soundinfo\u0000');
    content = msgpack.encode(nks);
    // header
    // size of frame contents
    frameHeader = new BufferBuilder().push('GEOB').pushSyncsafeInt(nksHeader.buf.length + content.length).push([
      0x00,
      0x00 // flags
    ]);
    // return buffer
    return Buffer.concat([frameHeader.buf, nksHeader.buf, content]);
  };

  _modesAndTypes = function(modes, types) {
    var j, k, len, len1, len2, len3, list, m, mode, n, t;
    list = [];
    if (modes) {
      for (j = 0, len = modes.length; j < len; j++) {
        mode = modes[j];
        list.push(`\\.${mode}`);
      }
    }
    if (types) {
      for (k = 0, len1 = types.length; k < len1; k++) {
        t = types[k];
        if (t && t.length && t[0]) {
          list.push(`\\:${t[0]}`);
        }
      }
      for (m = 0, len2 = types.length; m < len2; m++) {
        t = types[m];
        if (t && t.length > 1 && t[0] && t[1]) {
          list.push(`\\:${t[0]}\\:${t[1]}`);
        }
      }
      for (n = 0, len3 = types.length; n < len3; n++) {
        t = types[n];
        if (t && t.length > 2 && t[0] && t[1] && t[2]) {
          list.push(`\\:${t[0]}\\:${t[1]}\\:${t[2]}`);
        }
      }
    }
    return _.uniq(list);
  };

  _validate = function(data) {
    var i, key, results, v, value;
    results = [];
    for (key in data) {
      value = data[key];
      if (key !== 'name' && key !== 'author' && key !== 'vendor' && key !== 'comment' && key !== 'deviceType' && key !== 'bankchain' && key !== 'tempo' && key !== 'types' && key !== 'modes' && key !== 'syncFilename' && key !== 'removeUnnecessaryChunks') {
        throw new Error(`Unknown data property: [${key}]`);
      }
      switch (key) {
        case 'name':
          results.push(assert.ok(_.isString(value, `data.name should be String. ${value}`)));
          break;
        case 'author':
          results.push(assert.ok(_.isString(value, `data.author should be String. ${value}`)));
          break;
        case 'vendor':
          results.push(assert.ok(_.isString(value, `data.vendor should be String. ${value}`)));
          break;
        case 'comment':
          if (value) {
            results.push(assert.ok(_.isString(value, `data.vendor should be String. ${value}`)));
          } else {
            results.push(void 0);
          }
          break;
        case 'bankchain':
          if (value) {
            assert.ok(_.isArray(value, `data.bankchain should be Array of String. ${value}`));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                results1.push(assert.ok(_.isString(v, `data.bankchain should be Array of String. ${value}`)));
              }
              return results1;
            })());
          } else {
            results.push(void 0);
          }
          break;
        case 'deviceType':
          if (value) {
            assert.ok(_.isString(value, `data.deviceType should be String. ${value}`));
            results.push(assert.ok(value === 'LOOP' || value === 'ONESHOT', `data.deviceType should be 'LOOP' or 'ONESHOT'. ${value}`));
          } else {
            results.push(void 0);
          }
          break;
        case 'tempo':
          if (value) {
            results.push(assert.ok(_.isNumber(value, `data.tempo should be number. ${value}`)));
          } else {
            results.push(void 0);
          }
          break;
        case 'types':
          if (value) {
            assert.ok(_.isArray(value, `data.types should be 2 dimensional Array of String. ${value}`));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                assert.ok(_.isArray(v, `data.types should be Array of String. ${value}`));
                assert.ok(v.length > 0 && v.length <= 3, `data.types lenth of inner array should be 1 - 3. ${value}`);
                results1.push((function() {
                  var k, len1, results2;
                  results2 = [];
                  for (k = 0, len1 = v.length; k < len1; k++) {
                    i = v[k];
                    results2.push(assert.ok(_.isString(i, `data.types should be 2 dimensional Array of String. ${value}`)));
                  }
                  return results2;
                })());
              }
              return results1;
            })());
          } else {
            results.push(void 0);
          }
          break;
        case 'modes':
          if (value) {
            assert.ok(_.isArray(value, `data.modes should be Array of String. ${value}`));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                results1.push(assert.ok(_.isString(v, `data.modes should be Array of String. ${value}`)));
              }
              return results1;
            })());
          } else {
            results.push(void 0);
          }
          break;
        default:
          results.push(void 0);
      }
    }
    return results;
  };

  // helper class for building buffer
  // ---------------------------------
  BufferBuilder = class BufferBuilder {
    constructor() {
      this.buf = new Buffer(0);
    }

    
    // @value byte or byte array or string
    push(value) {
      switch (false) {
        case !_.isNumber(value):
          // byte
          this.buf = Buffer.concat([this.buf, new Buffer([value])]);
          break;
        default:
          // string or byte array
          this.buf = Buffer.concat([this.buf, new Buffer(value)]);
      }
      return this;
    }

    pushUInt32LE(value) {
      var b;
      b = new Buffer(4);
      b.writeUInt32LE(value);
      this.buf = Buffer.concat([this.buf, b]);
      return this;
    }

    // 7bit * 4 = 28 bit
    pushSyncsafeInt(size) {
      var b;
      b = [];
      b.push((size >> 21) & 0x0000007f);
      b.push((size >> 14) & 0x0000007f);
      b.push((size >> 7) & 0x0000007f);
      b.push(size & 0x0000007f);
      this.push(b);
      return this;
    }

    pushHex(value) {
      this.buf = Buffer.concat([this.buf, new Buffer(value, 'hex')]);
      return this;
    }

    pushUcs2String(value) {
      var l;
      l = value && value.length ? value.length : 0;
      this.pushUInt32LE(l);
      if (l) {
        this.buf = Buffer.concat([this.buf, new Buffer(value, 'ucs2')]);
      }
      return this;
    }

    pushUcs2StringArray(value) {
      var j, len, v;
      if ((_.isArray(value)) && value.length) {
        this.pushUInt32LE(value.length);
        for (j = 0, len = value.length; j < len; j++) {
          v = value[j];
          this.pushUcs2String(v);
        }
      } else {
        this.pushUInt32LE(0);
      }
      return this;
    }

    pushKeyValuePairs(value) {
      var j, len, pair;
      if ((_.isArray(value)) && value.length) {
        this.pushUInt32LE(value.length);
        for (j = 0, len = value.length; j < len; j++) {
          pair = value[j];
          this.pushUcs2String(`\\@${pair[0]}`);
          this.pushUcs2String(pair[1]);
        }
      } else {
        this.pushUInt32LE(0);
      }
      return this;
    }

  };

}).call(this);
