## gulp-maschine-id3

Gulp plugin for adding maschine-aware metadata chunk to WAVE file.

## Installation
```
  npm install gulp-maschine-id3 --save-dev
```

## Usage

using the function to provide data.
```coffeescript
id3 = require 'gulp-maschine-id3'
gulp.task 'hoge', ->
  gulp.src ["src/**/*.wav"]
    .pipe id3 (file, chunks) ->
      # do something to create data
      name: path.basename file.path, '.wav'
      vendor: 'Hahaha'
      author: 'Hehehe'
      comment: 'uniuni'
      bankchain: ['Fugafuga', 'Fugafuga 1.1 Library']
      deviceType: 'LOOP'
      types: [
        ['Bass', 'Synth Bass']
      ]
      modes: ['Additive', 'Analog']
    .pipe gulp.dest "dist"
```
using the non-blocking function to provide data.
```coffeescript
id3 = require 'gulp-maschine-id3'
gulp.task 'hoge', ->
  gulp.src ['src/**/*.wav']
    .pipe id3 (file, chunks, done) ->
      # create data in non-blocking function
      non_blockingfunction files, chunks, (err, data) ->
      done err, data
   .pipe gulp.dest 'dist'
```

list all chunk ids included in source file.
```coffeescript
id3 = require 'gulp-maschine-id3'
gulp.task 'hoge', ->
  gulp.src ['src/**/*.wav']
    .pipe id3 (file, chunks) ->
      console.info (chunk.id for chunk in chunks)
      # if return null or undefined, file will not be changed.
      undefined
```

## API

### id3(data)

#### data
Type: `Object` or `function(file, chunks [,callback])`

The data object or function to provide metadata.

##### data.name [optional]  default: source filename
Type: `String`

##### data.author [optional]
Type: `String`

##### data.vendor [optional]
Type: `String`

##### data.comment [optional]
Type: `String`

##### data.deviceType [optional]
Type: `String`

'LOOP' or 'ONESHOT', default 'ONESHOT'

##### data.bankchain [optional]
Type: `Array` of `String`

The length of array should be 1 or 2.

##### data.types [optional]
Type: 2 dimensional `Array` of `String`

The length of inner array should be 1 - 3

examle:
```coffeescript
  [
    ['Bass', 'Synth Bass', 'Ugly']
    ['Bass', 'Synth Bass', 'Dirty']
  ]
```

##### data.modes [optional]
Type: `Array` of `String`

examle:
```coffeescript
  ['Additive', 'Analog']
```

##### data.syncFilename [optional] default: true
Type: `bool`

use data.name as filename.

##### data.removeUnnecessaryChunks [optional] default: true
Type: `bool`

remove all chunks except 'fmt ' or 'data'.

#### function (file, chunks [,callbak])
The functoin to provide data.

##### file
Type: instance of `vinyl` file

##### chunks
Type: `Array of Object`

The RIFF chunks of source file.

properties of element

  - id: String - chunk id
  - data: Buffer - content of chunk

##### callback
Type: `function(err, data)`

The callback function to support non-blocking data provider.

## Notes
 - only support '.wav' file.
 - this plugin replace the exsiting ID3 chunk.
 - [here](https://github.com/jhorology/loooops) is an example project for this plugin.
 - v0.1.0 was tested only with Komplete Kontrol v2.1 and Maschine v2.8.0.
