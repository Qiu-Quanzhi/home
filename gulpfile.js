import gulp from 'gulp';
import rev from 'gulp-rev';
import revRewrite from 'gulp-rev-rewrite';
var cleanCSS = require('gulp-clean-css');
var htmlmin = require('gulp-html-minifier-terser');
var htmlclean = require('gulp-htmlclean');
var terser = require('gulp-terser');
var revdel = require('gulp-rev-delete-original');
// 压缩js
gulp.task('minify-js', () =>
    gulp.src(['./public/**/*.js']) //, '!./public/**/*.min.js'
        .pipe(terser({
            compress: {
                drop_console: true, // 删除console
                drop_debugger: true
            }
        }))
        .pipe(rev())
        .pipe(gulp.dest('public'))
        .pipe(revdel())
        .pipe(rev.manifest({
            path: 'public/rev-manifest.json',
            base: 'public',
            merge: true
        }))
        .pipe(gulp.dest('public'))
)
//压缩css
gulp.task('minify-css', () => {
    return gulp.src(['public/**/*.css'])
        .pipe(cleanCSS({
            compatibility: '*'
        }))
        .pipe(rev())
        .pipe(gulp.dest('public'))
        .pipe(revdel())
        .pipe(rev.manifest({
            path: 'public/rev-manifest.json',
            base: 'public',
            merge: true
        }))
        .pipe(gulp.dest('public'))
});
//压缩html
gulp.task('minify-html',() => {
    return gulp.src('public/**/*.html')
        .pipe(revRewrite({ manifest: readFileSync('public/rev-manifest.json') }))
        .pipe(htmlclean())
        .pipe(htmlmin({
            collapseBooleanAttributes: true,
            collapseInlineTagWhitespace: true,
            collapseWhitespace: true,
            decodeEntities: true,
            minifyJS: {
                compress: {
                    drop_console: true,
                    drop_debugger: true
                }
            },
            minifyCSS: {
                compatibility: '*'
            },
            minifyURLs: true,
            removeComments: true,
            removeEmptyAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true
        }))
        .pipe(gulp.dest('public'))
});

gulp.task('default', gulp.series(
    gulp.parallel(
        'minify-js', 'minify-css'
    ),
    'minify-html'
))