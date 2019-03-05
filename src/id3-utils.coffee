assert       = require 'assert'

module.exports =
  ###
  3.   ID3v2 overview

   ID3v2 is a general tagging format for audio, which makes it possible
   to store meta data about the audio inside the audio file itself. The
   ID3 tag described in this document is mainly targeted at files
   encoded with MPEG-1/2 layer I, MPEG-1/2 layer II, MPEG-1/2 layer III
   and MPEG-2.5, but may work with other types of encoded audio or as a
   stand alone format for audio meta data.

   ID3v2 is designed to be as flexible and expandable as possible to
   meet new meta information needs that might arise. To achieve that
   ID3v2 is constructed as a container for several information blocks,
   called frames, whose format need not be known to the software that
   encounters them. At the start of every frame is an unique and
   predefined identifier, a size descriptor that allows software to skip
   unknown frames and a flags field. The flags describes encoding
   details and if the frame should remain in the tag, should it be
   unknown to the software, if the file is altered.

   The bitorder in ID3v2 is most significant bit first (MSB). The
   byteorder in multibyte numbers is most significant byte first (e.g.
   $12345678 would be encoded $12 34 56 78), also known as big endian
   and network byte order.

   Overall tag structure:

     +-----------------------------+
     |      Header (10 bytes)      |
     +-----------------------------+
     |       Extended Header       |
     | (variable length, OPTIONAL) |
     +-----------------------------+
     |   Frames (variable length)  |
     +-----------------------------+
     |           Padding           |
     | (variable length, OPTIONAL) |
     +-----------------------------+
     | Footer (10 bytes, OPTIONAL) |
     +-----------------------------+

   In general, padding and footer are mutually exclusive. See details in
   sections 3.3, 3.4 and 5.
  ###
  parseID3v2: (content) ->
    obj = {}
    offset = 0
    
    # ID3v2 Header
    obj.header = @parseID3v2Header content, offset
    # size of extendedHeader + frames + padding
    contentSize = content.length - (if obj.header.flags.footerPresent then 20 else 10)
    unless obj.header.size is contentSize
      console.warn '[id3-utils]', "size mismatch. ID3v2 size shuold be #{contentSize}, occurs:#{obj.header.size}."
    offset += 10

    # ID3v2 Extended header
    if obj.header.flags.extendedHeader
      obj.extendedHeader = @parseID3v2ExtendedHeader content, offset
      offset += obj.extendedHeader.size
      # size of frames + padding
      contetntSize -= obj.extendedHeader.size
      
    if contentSize > 0
      # ID3v2 frames
      obj.startAddressOfFrames = offset
      obj.frames = @parseID3v2Frames content, offset, contentSize, obj.header.majorVersion >= 4
      obj.sizeOfTotalFrames = @sizeOfTotalSizeFrames obj.frames
      if obj.sizeOfTotalFrames < contentSize
        # ID3v2 Padding
        obj.startAddressOfPadding = offset + obj.sizeOfTotalFrames
        obj.sizeOfPadding = contentSize - obj.sizeOfTotalFrames
    offset += contentSize

    # ID3v2 Extended footer
    if obj.header.flags.footerPresent
      obj.footer = @parseID3v2Footer content, offset
    obj
    
  ###
  3.1.   ID3v2 header

     The first part of the ID3v2 tag is the 10 byte tag header, laid out
     as follows:

       ID3v2/file identifier      "ID3"
       ID3v2 version              $04 00
       ID3v2 flags                %abcd0000
       ID3v2 size             4 * %0xxxxxxx

     The first three bytes of the tag are always "ID3", to indicate that
     this is an ID3v2 tag, directly followed by the two version bytes. The
     first byte of ID3v2 version is its major version, while the second
     byte is its revision number. In this case this is ID3v2.4.0. All
     revisions are backwards compatible while major versions are not. If
     software with ID3v2.4.0 and below support should encounter version
     five or higher it should simply ignore the whole tag. Version or
     revision will never be $FF.

     The version is followed by the ID3v2 flags field, of which currently
     four flags are used.


     a - Unsynchronisation

       Bit 7 in the 'ID3v2 flags' indicates whether or not
       unsynchronisation is applied on all frames (see section 6.1 for
       details); a set bit indicates usage.


     b - Extended header

       The second bit (bit 6) indicates whether or not the header is
       followed by an extended header. The extended header is described in
       section 3.2. A set bit indicates the presence of an extended
       header.


     c - Experimental indicator

       The third bit (bit 5) is used as an 'experimental indicator'. This
       flag SHALL always be set when the tag is in an experimental stage.


     d - Footer present

       Bit 4 indicates that a footer (section 3.4) is present at the very
       end of the tag. A set bit indicates the presence of a footer.


     All the other flags MUST be cleared. If one of these undefined flags
     are set, the tag might not be readable for a parser that does not
     know the flags function.

     The ID3v2 tag size is stored as a 32 bit synchsafe integer (section
     6.2), making a total of 28 effective bits (representing up to 256MB).

     The ID3v2 tag size is the sum of the byte length of the extended
     header, the padding and the frames after unsynchronisation. If a
     footer is present this equals to ('total size' - 20) bytes, otherwise
     ('total size' - 10) bytes.

     An ID3v2 tag can be detected with the following pattern:
       $49 44 33 yy yy xx zz zz zz zz
     Where yy is less than $FF, xx is the 'flags' byte and zz is less than
     $80.
  ###
  parseID3v2Header: (content, offset) ->
    id = content.toString 'ascii', offset, offset + 3
    assert.ok id is 'ID3', "unknown identifier. Id:[#{id}]"
    offset += 3
    
    majorVersion = content.readUInt8 offset
    # assert.ok majorVersion is 4, "unsupported ID3 version. majorVersion:[#{majorVersion}]"
    offset += 1
    
    minorVersion = content.readUInt8 offset
    offset += 1
    
    flags = content.readUInt8 5
    offset += 1
    
    size = @fromSyncsafeInt content, offset, offset + 4
    id: id
    version: "ID3v2.#{majorVersion}.#{minorVersion}"
    majorVersion: majorVersion
    minorVersion: minorVersion
    flags:
      unsynchronisation: (flags & 0x80) isnt 0
      extendedHeader: (flags & 0x40) isnt 0
      experimentalIndicator: (flags & 0x20) isnt 0
      footerPresent: (flags & 0x10) isnt 0
    size: size

  ###
  3.2. Extended header

     The extended header contains information that can provide further
     insight in the structure of the tag, but is not vital to the correct
     parsing of the tag information; hence the extended header is
     optional.

       Extended header size   4 * %0xxxxxxx
       Number of flag bytes       $01
       Extended Flags             $xx

     Where the 'Extended header size' is the size of the whole extended
     header, stored as a 32 bit synchsafe integer. An extended header can
     thus never have a size of fewer than six bytes.

     The extended flags field, with its size described by 'number of flag
     bytes', is defined as:

       %0bcd0000

     Each flag that is set in the extended header has data attached, which
     comes in the order in which the flags are encountered (i.e. the data
     for flag 'b' comes before the data for flag 'c'). Unset flags cannot
     have any attached data. All unknown flags MUST be unset and their
     corresponding data removed when a tag is modified.

     Every set flag's data starts with a length byte, which contains a
     value between 0 and 127 ($00 - $7f), followed by data that has the
     field length indicated by the length byte. If a flag has no attached
     data, the value $00 is used as length byte.


     b - Tag is an update

       If this flag is set, the present tag is an update of a tag found
       earlier in the present file or stream. If frames defined as unique
       are found in the present tag, they are to override any
       corresponding ones found in the earlier tag. This flag has no
       corresponding data.

           Flag data length      $00

     c - CRC data present

       If this flag is set, a CRC-32 [ISO-3309] data is included in the
       extended header. The CRC is calculated on all the data between the
       header and footer as indicated by the header's tag length field,
       minus the extended header. Note that this includes the padding (if
       there is any), but excludes the footer. The CRC-32 is stored as an
       35 bit synchsafe integer, leaving the upper four bits always
       zeroed.

          Flag data length       $05
          Total frame CRC    5 * %0xxxxxxx

     d - Tag restrictions

       For some applications it might be desired to restrict a tag in more
       ways than imposed by the ID3v2 specification. Note that the
       presence of these restrictions does not affect how the tag is
       decoded, merely how it was restricted before encoding. If this flag
       is set the tag is restricted as follows:

          Flag data length       $01
          Restrictions           %ppqrrstt

       p - Tag size restrictions

         00   No more than 128 frames and 1 MB total tag size.
         01   No more than 64 frames and 128 KB total tag size.
         10   No more than 32 frames and 40 KB total tag size.
         11   No more than 32 frames and 4 KB total tag size.

       q - Text encoding restrictions

         0    No restrictions
         1    Strings are only encoded with ISO-8859-1 [ISO-8859-1] or
              UTF-8 [UTF-8].

       r - Text fields size restrictions

         00   No restrictions
         01   No string is longer than 1024 characters.
         10   No string is longer than 128 characters.
         11   No string is longer than 30 characters.

         Note that nothing is said about how many bytes is used to
         represent those characters, since it is encoding dependent. If a
         text frame consists of more than one string, the sum of the
         strungs is restricted as stated.

       s - Image encoding restrictions

         0   No restrictions
         1   Images are encoded only with PNG [PNG] or JPEG [JFIF].

       t - Image size restrictions

         00  No restrictions
         01  All images are 256x256 pixels or smaller.
         10  All images are 64x64 pixels or smaller.
         11  All images are exactly 64x64 pixels, unless required
             otherwise.
  ###
  parseID3v2ExtendedHeader: (content, offset) ->
    @removeUndefinedProperty @_parseID3v2ExtendedHeader content, offset

  _parseID3v2ExtendedHeader: (content, offset) ->
    size = @fromSyncsafeInt content, offset, 4
    assert.ok size >= 6, "An extended header can thus never have a size of fewer than 6 byte. occurs:#{size}"
    offset += 4
    
    numberOfFlagBytes = content.readUInt8 4
    assert.ok numberOfFlagBytes is 1, "Number of flags bytes of extened header should be 1. occurs:#{numberOfFlagBytes}"
    offset += 1
    
    flags = content.readUInt8 5
    offset += 1
    
    size: size
    tagIsAnUpdate: if flags & 0x40
      length = content.readUInt8 offset
      assert.ok length is 0, "Flag data length of [Tag is an update] should be 0. occurs:#{length}"
      offset += 1
      on
    crcDataPresent: if flags & 0x20
      length = content.readUInt8 offset
      assert.ok length is 5, "Flag data length of [CRC data present] should be 5. occurs:#{length}"
      offset += 1
      crc = @fromSyncsafeInt content.slice offset, offset + 5
      offset += 5
      crc: crc
    tagRestrictions: if flags & 0x10
      length = content.readUInt8 offset
      assert.ok length is 1, "Flag data length of [Tag Restrictions] should be 1. occurs:#{length}"
      offset += 1
      restrictions = content.readUInt8 offset
      tagSize: [
        '0 - No more than 128 frames and 1 MB total tag size.'
        '1 - No more than 64 frames and 128 KB total tag size.'
        '2 - No more than 32 frames and 40 KB total tag size.'
        '3 - No more than 32 frames and 4 KB total tag size.'
       ][restrictions >> 6]
      textEncoding: [
        '0 - No more than 128 frames and 1 MB total tag size.'
        '1 - No more than 64 frames and 128 KB total tag size.'
      ][restrictions >> 5 & 1]
      textfieldsSize: [
        '0 - No restrictions'
        '1 - No string is longer than 1024 characters.'
        '2 - No string is longer than 128 characters.'
        '3 - No string is longer than 30 characters.'
      ][restrictions >> 3 & 3]
      imageEncoding: [
        '0 - No restrictions'
        '1 - Images are encoded only with PNG [PNG] or JPEG [JFIF].'
      ][restrictions >> 2 & 1]
      imageSize: [
        '0 - No restrictions'
        '1 - All images are 256x256 pixels or smaller.'
        '2 - All images are 64x64 pixels or smaller.'
        '3 - All images are exactly 64x64 pixels, unless required otherwise.'
      ][restrictions & 3]

  ###
  4.   ID3v2 frame overview

     All ID3v2 frames consists of one frame header followed by one or more
     fields containing the actual information. The header is always 10
     bytes and laid out as follows:

       Frame ID      $xx xx xx xx  (four characters)
       Size      4 * %0xxxxxxx
       Flags         $xx xx

     The frame ID is made out of the characters capital A-Z and 0-9.
     Identifiers beginning with "X", "Y" and "Z" are for experimental
     frames and free for everyone to use, without the need to set the
     experimental bit in the tag header. Bear in mind that someone else
     might have used the same identifier as you. All other identifiers are
     either used or reserved for future use.

     The frame ID is followed by a size descriptor containing the size of
     the data in the final frame, after encryption, compression and
     unsynchronisation. The size is excluding the frame header ('total
     frame size' - 10 bytes) and stored as a 32 bit synchsafe integer.

     In the frame header the size descriptor is followed by two flag
     bytes. These flags are described in section 4.1.

     There is no fixed order of the frames' appearance in the tag,
     although it is desired that the frames are arranged in order of
     significance concerning the recognition of the file. An example of
     such order: UFID, TIT2, MCDI, TRCK ...

     A tag MUST contain at least one frame. A frame must be at least 1
     byte big, excluding the header.

     If nothing else is said, strings, including numeric strings and URLs
     [URL], are represented as ISO-8859-1 [ISO-8859-1] characters in the
     range $20 - $FF. Such strings are represented in frame descriptions
     as <text string>, or <full text string> if newlines are allowed. If
     nothing else is said newline character is forbidden. In ISO-8859-1 a
     newline is represented, when allowed, with $0A only.

     Frames that allow different types of text encoding contains a text
     encoding description byte. Possible encodings:

       $00   ISO-8859-1 [ISO-8859-1]. Terminated with $00.
       $01   UTF-16 [UTF-16] encoded Unicode [UNICODE] with BOM. All
             strings in the same frame SHALL have the same byteorder.
             Terminated with $00 00.
       $02   UTF-16BE [UTF-16] encoded Unicode [UNICODE] without BOM.
             Terminated with $00 00.
       $03   UTF-8 [UTF-8] encoded Unicode [UNICODE]. Terminated with $00.

     Strings dependent on encoding are represented in frame descriptions
     as <text string according to encoding>, or <full text string
     according to encoding> if newlines are allowed. Any empty strings of
     type $01 which are NULL-terminated may have the Unicode BOM followed
     by a Unicode NULL ($FF FE 00 00 or $FE FF 00 00).

     The timestamp fields are based on a subset of ISO 8601. When being as
     precise as possible the format of a time string is
     yyyy-MM-ddTHH:mm:ss (year, "-", month, "-", day, "T", hour (out of
     24), ":", minutes, ":", seconds), but the precision may be reduced by
     removing as many time indicators as wanted. Hence valid timestamps
     are
     yyyy, yyyy-MM, yyyy-MM-dd, yyyy-MM-ddTHH, yyyy-MM-ddTHH:mm and
     yyyy-MM-ddTHH:mm:ss. All time stamps are UTC. For durations, use
     the slash character as described in 8601, and for multiple non-
     contiguous dates, use multiple strings, if allowed by the frame
     definition.

     The three byte language field, present in several frames, is used to
     describe the language of the frame's content, according to ISO-639-2
     [ISO-639-2]. The language should be represented in lower case. If the
     language is not known the string "XXX" should be used.

     All URLs [URL] MAY be relative, e.g. "picture.png", "../doc.txt".

     If a frame is longer than it should be, e.g. having more fields than
     specified in this document, that indicates that additions to the
     frame have been made in a later version of the ID3v2 standard. This
     is reflected by the revision number in the header of the tag.
  ###
  parseID3v2Frames: (content, offset, contentSize, useSyncsafeSize) ->
    frames = []
    totalSize = 0
    # flame should have minimum 10byte
    while (contentSize - totalSize) >= 10
      id = content.toString 'ascii', offset, offset + 4
      # if padding bytes
      break if id is '\u0000\u0000\u0000\u0000'
      offset += 4
      
      size =  if useSyncsafeSize
        @fromSyncsafeInt content, offset, offset + 4
      else
        content.readUInt32BE offset, offset + 4
      offset += 4
      
      flags = [
        content.readUInt8 offset
        content.readUInt8 offset + 1
      ]
      offset += 2
      
      # workaround
      # Some files in NI library has wrong frame size as UInt32BE instead of SyncsafeInt
      
            
      data = content.slice offset, offset + size
      offset += size

      totalSize += size + 10
      
      id: id
      size: size
      flags: flags
      content: data


  ###
  3.4.   ID3v2 footer

     To speed up the process of locating an ID3v2 tag when searching from
     the end of a file, a footer can be added to the tag. It is REQUIRED
     to add a footer to an appended tag, i.e. a tag located after all
     audio data. The footer is a copy of the header, but with a different
     identifier.

       ID3v2 identifier           "3DI"
       ID3v2 version              $04 00
       ID3v2 flags                %abcd0000
       ID3v2 size             4 * %0xxxxxxx
  ###
  parseID3v2Footer: (content, offset) ->
    id = (content.slice offset, 3).toString()
    assert.ok id is '3DI', "unknown footer identifier. Id:[#{id}]"
    offset += 3
    
    majorVersion = content.readUInt8 offset
    offset += 1

    minorVersion = content.readUInt8 offset
    offset += 1

    flags = content.readUInt8 offset
    offset += 1

    size = @fromSyncsafeInt content.slice 6, 10
    offset += 4
    
    identifier: id
    version: "ID3v2.#{majorVersion}.#{minorVersion}"
    flags:
      unsynchronisation: (flags & 0x80) isnt 0
      extendedHeader: (flags & 0x40) isnt 0
      experimentalIndicator: (flags & 0x20) isnt 0
      footerPresent: (flags & 0x10) isnt 0
    size: size

  sizeOfTotalSizeFrames: (frames) ->
    if frames and frames.length
      (frames.map (f) -> f.size + 10).reduce (a, c) -> a + c
    else
      0

  toSyncsafeInt: (v, size) ->
    Buffer.from(v >> 7 * i & 0x7f for i in [size - 1..0])

  fromSyncsafeInt: (buffer, start, end) ->
    if start is undefined
      start = 0
      end = buffer.length
    buffer[start...end].reduce (a, c) -> (a << 7) + c

  removeUndefinedProperty: (o) -> Object.keys(o).forEach (key) -> o[key] is undefined and delete o[key]
