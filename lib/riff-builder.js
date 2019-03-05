(function() {
  // RIFF builder

  // @ref https://msdn.microsoft.com/en-us/library/windows/desktop/dd798636(v=vs.85).aspx
  var RIFFBuilder, _, assert;

  assert = require('assert');

  _ = require('underscore');

  // function(file, formType)

  // - file      String filepath or content buffer
  // - fileType  4 characters id
  // - return    instance of builder
  module.exports = function(formType) {
    return new RIFFBuilder(formType);
  };

  RIFFBuilder = class RIFFBuilder {
    // new RIFFBuilder(file, formType)

    // - file      String filepath or content buffer
    // - fileType  4 characters id
    constructor(formType) {
      this.buf = new Buffer(0);
      // file headder
      this._pushId('RIFF'); // magic
      this._pushUInt32(4); // size
      this._pushId(formType); // file type
    }

    
    // pushChunk(chunkId, data)

    // - chunkId  4 characters id
    // - data     chunk data buffer.
    // - return this instance.
    pushChunk(chunkId, data) {
      this._pushId(chunkId);
      this._pushUInt32(data.length);
      if (data.length) {
        this._push(data);
      }
      
      // padding for 16bit boundary
      if (data.length & 0x01) {
        this._padding();
      }
      return this;
    }

    // buffer()

    // - return current buffer of RIFF file content
    buffer() {
      // set file size = buffer size - 8 (magic + size)
      this.buf.writeUInt32LE(this.tell() - 8, 4);
      return this.buf;
    }

    // tell()

    // - return current buffer size.
    tell() {
      return this.buf.length;
    }

    _push(buf, start, end) {
      var b;
      b = buf;
      if (_.isNumber(start)) {
        if (_.isNumber(end)) {
          b = buf.slice(start, end);
        } else {
          b = buf.slice(start);
        }
      }
      this.buf = Buffer.concat([this.buf, b]);
      return this;
    }

    _pushUInt32(value) {
      var b;
      b = new Buffer(4);
      b.writeUInt32LE(value, 0);
      this._push(b);
      return this;
    }

    _pushId(value) {
      var b;
      assert.ok(_.isString(value), `Id msut be string. id:${value}`);
      b = new Buffer(value, 'ascii');
      assert.ok(b.length === 4, `Id msut be 4 characters string. id:${value}`);
      this._push(b);
      return this;
    }

    _padding(value) {
      this._push(new Buffer([0]));
      return this;
    }

  };

}).call(this);
