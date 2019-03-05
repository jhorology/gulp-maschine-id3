gulp        = require 'gulp'
coffeelint  = require 'gulp-coffeelint'
coffee      = require 'gulp-coffee'
del         = require 'del'
riff        = require 'gulp-riff-extractor'
tap         = require 'gulp-tap'
beautify    = require 'js-beautify'
id3         = require './src/id3-utils'
ni          = require './src/ni-soundinfo'

gulp.task 'coffeelint', ->
  gulp.src ['./*.coffee', './src/*.coffee']
    .pipe coffeelint './coffeelint.json'
    .pipe coffeelint.reporter()

gulp.task 'coffee', gulp.series 'coffeelint', ->
  gulp.src ['./src/*.coffee']
    .pipe coffee()
    .pipe gulp.dest './lib'

gulp.task 'default', gulp.series 'coffee'

gulp.task 'watch', ->
  gulp.watch './**/*.coffee', gulp.task 'default'

gulp.task 'clean', (cb) ->
  del ['./lib/*.js', './**/*~'], force: true, cb

# to investigate NI Library
gulp.task 'parse-nks-soundinfo', ->
  # gulp.src ['/Volumes/Media/Music/Native Instruments/**/*.wav']
  gulp.src ['./samples/*.wav']
    .pipe riff
      form_type: 'WAVE'
      chunk_ids: ['ID3 ']
    .pipe tap (file) ->
      console.info "### #{file.path}"
      o = id3.parseID3v2 file.contents
      # console.info beautify JSON.stringify o
      nksFrame = o.frames.find (frame) -> ni.isFrameNKS frame
      niFrame = o.frames.find (frame) -> ni.isFrameNISound frame
      info =
        nks: (ni.decodeNKS nksFrame if nksFrame)
        ni: (ni.decodeNI niFrame if niFrame)
      if nksFrame or niFrame
        console.info beautify JSON.stringify info
