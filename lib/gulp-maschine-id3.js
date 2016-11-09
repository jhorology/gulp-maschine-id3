(function() {
  var BufferBuilder, PLUGIN_NAME, _, _build_geob_frame, _build_id3_chunk, _id3, _parseSourceWavChunks, _types, _validate, assert, gutil, path, riffBuilder, riffReader, through,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  assert = require('assert');

  path = require('path');

  through = require('through2');

  gutil = require('gulp-util');

  _ = require('underscore');

  riffReader = require('riff-reader');

  riffBuilder = require('./riff-builder');

  PLUGIN_NAME = 'maschine-id3';

  module.exports = function(data) {
    return through.obj(function(file, enc, cb) {
      var alreadyCalled, chunks, error, id3, providedData;
      alreadyCalled = false;
      id3 = (function(_this) {
        return function(err, data) {
          var error;
          if (alreadyCalled) {
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'duplicate callback calls.'));
            return;
          }
          alreadyCalled = true;
          if (err) {
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
            return cb();
          }
          try {
            if (data) {
              _id3(file, data);
            }
            _this.push(file);
          } catch (error1) {
            error = error1;
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, error));
          }
          return cb();
        };
      })(this);
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
    assert.ok((indexOf.call(ids, 'fmt ') >= 0), "[fmt ] chunk is not contained in file.");
    assert.ok((indexOf.call(ids, 'data') >= 0), "[data] chunk is not contained in file.");
    return file.chunks = chunks;
  };

  _id3 = function(file, data) {
    var basename, chunk, chunks, dirname, extname, j, len, wav;
    extname = path.extname(file.path);
    basename = path.basename(file.path, extname);
    dirname = path.dirname(file.path);
    data = _.defaults(data, {
      name: basename,
      syncFilename: true,
      removeUnnecessaryChunks: true
    });
    _validate(data);
    chunks = data.removeUnnecessaryChunks ? file.chunks.filter(function(c) {
      var ref;
      return (ref = c.id) === 'fmt ' || ref === 'data';
    }) : file.chunks.filter(function(c) {
      return c.id !== 'ID3 ';
    });
    if (data.syncFilename) {
      file.path = path.join(dirname, data.name + extname);
    }
    wav = riffBuilder('WAVE');
    for (j = 0, len = chunks.length; j < len; j++) {
      chunk = chunks[j];
      wav.pushChunk(chunk.id, chunk.data);
    }
    wav.pushChunk('ID3 ', _build_id3_chunk(data));
    return file.contents = wav.buffer();
  };

  _build_id3_chunk = function(data) {
    var geobFrame, header;
    geobFrame = _build_geob_frame(data);
    header = new BufferBuilder().push('ID3').push([0x04, 0x00]).push(0x00).pushSyncsafeInt(geobFrame.length + 1024);
    return Buffer.concat([header.buf, geobFrame, Buffer.alloc(1024, 0)]);
  };

  _build_geob_frame = function(data) {
    var contents, header;
    contents = new BufferBuilder().pushHex('000000').push('com.native-instruments.nisound.soundinfo\u0000').pushHex('020000000100000000000000').pushUcs2String(data.name).pushUcs2String(data.author).pushUcs2String(data.vendor).pushUcs2String(data.comment).pushHex('00000000ffffffffffffffff000000000000000000000000000000000000000001000000').pushUcs2StringArray(data.bankchain).pushUcs2StringArray(_types(data.types)).pushHex('00000000').pushKeyValuePairs([['color', '0'], ['devicetypeflags', '0'], ['soundtype', '0'], ['tempo', '0'], ['verl', '1.7.13'], ['verm', '1.7.13'], ['visib', '0']]);
    header = new BufferBuilder().push('GEOB').pushSyncsafeInt(contents.buf.length).push([0x00, 0x00]);
    return Buffer.concat([header.buf, contents.buf]);
  };

  _types = function(types) {
    var j, k, len, len1, len2, list, m, t;
    list = [];
    for (j = 0, len = types.length; j < len; j++) {
      t = types[j];
      if (t && t.length && t[0]) {
        list.push("\\:" + t[0]);
      }
    }
    for (k = 0, len1 = types.length; k < len1; k++) {
      t = types[k];
      if (t && t.length > 1 && t[0] && t[1]) {
        list.push("\\:" + t[0] + "\\:" + t[1]);
      }
    }
    for (m = 0, len2 = types.length; m < len2; m++) {
      t = types[m];
      if (t && t.length > 2 && t[0] && t[1] && t[2]) {
        list.push("\\:" + t[0] + "\\:" + t[1] + "\\:" + t[2]);
      }
    }
    return _.uniq(list);
  };

  _validate = function(data) {
    var i, key, results, v, value;
    results = [];
    for (key in data) {
      value = data[key];
      if (key !== 'name' && key !== 'author' && key !== 'vendor' && key !== 'comment' && key !== 'bankchain' && key !== 'types' && key !== 'modes' && key !== 'syncFilename' && key !== 'removeUnnecessaryChunks') {
        throw new Error("Unknown data property: [" + key + "]");
      }
      switch (key) {
        case 'name':
          results.push(assert.ok(_.isString(value, "data.name should be String. " + value)));
          break;
        case 'author':
          results.push(assert.ok(_.isString(value, "data.author should be String. " + value)));
          break;
        case 'vendor':
          results.push(assert.ok(_.isString(value, "data.vendor should be String. " + value)));
          break;
        case 'comment':
          if (value) {
            results.push(assert.ok(_.isString(value, "data.vendor should be String. " + value)));
          } else {
            results.push(void 0);
          }
          break;
        case 'bankchain':
          if (value) {
            assert.ok(_.isArray(value, "data.bankchain should be Array of String. " + value));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                results1.push(assert.ok(_.isString(v, "data.bankchain should be Array of String. " + value)));
              }
              return results1;
            })());
          } else {
            results.push(void 0);
          }
          break;
        case 'types':
          if (value) {
            assert.ok(_.isArray(value, "data.types should be 2 dimensional Array of String. " + value));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                assert.ok(_.isArray(v, "data.types should be Array of String. " + value));
                assert.ok(v.length > 0 && v.length <= 3, "data.types lenth of inner array should be 1 - 3. " + value);
                results1.push((function() {
                  var k, len1, results2;
                  results2 = [];
                  for (k = 0, len1 = v.length; k < len1; k++) {
                    i = v[k];
                    results2.push(assert.ok(_.isString(i, "data.types should be 2 dimensional Array of String. " + value)));
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
            assert.ok(_.isArray(value, "data.modess should be Array of String. " + value));
            results.push((function() {
              var j, len, results1;
              results1 = [];
              for (j = 0, len = value.length; j < len; j++) {
                v = value[j];
                results1.push(assert.ok(_.isString(v, "data.modes should be Array of String. " + value)));
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

  BufferBuilder = (function() {
    function BufferBuilder() {
      this.buf = new Buffer(0);
    }

    BufferBuilder.prototype.push = function(value) {
      switch (false) {
        case !_.isNumber(value):
          this.buf = Buffer.concat([this.buf, new Buffer([value])]);
          break;
        default:
          this.buf = Buffer.concat([this.buf, new Buffer(value)]);
      }
      return this;
    };

    BufferBuilder.prototype.pushUInt32LE = function(value) {
      var b;
      b = new Buffer(4);
      b.writeUInt32LE(value);
      this.buf = Buffer.concat([this.buf, b]);
      return this;
    };

    BufferBuilder.prototype.pushSyncsafeInt = function(size) {
      var b;
      b = [];
      b.push((size >> 21) & 0x0000007f);
      b.push((size >> 14) & 0x0000007f);
      b.push((size >> 7) & 0x0000007f);
      b.push(size & 0x0000007f);
      this.push(b);
      return this;
    };

    BufferBuilder.prototype.pushHex = function(value) {
      this.buf = Buffer.concat([this.buf, new Buffer(value, 'hex')]);
      return this;
    };

    BufferBuilder.prototype.pushUcs2String = function(value) {
      var l;
      l = value && value.length ? value.length : 0;
      this.pushUInt32LE(l);
      if (l) {
        this.buf = Buffer.concat([this.buf, new Buffer(value, 'ucs2')]);
      }
      return this;
    };

    BufferBuilder.prototype.pushUcs2StringArray = function(value) {
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
    };

    BufferBuilder.prototype.pushKeyValuePairs = function(value) {
      var j, len, pair;
      if ((_.isArray(value)) && value.length) {
        this.pushUInt32LE(value.length);
        for (j = 0, len = value.length; j < len; j++) {
          pair = value[j];
          this.pushUcs2String("\\@" + pair[0]);
          this.pushUcs2String(pair[1]);
        }
      } else {
        this.pushUInt32LE(0);
      }
      return this;
    };

    return BufferBuilder;

  })();

}).call(this);
