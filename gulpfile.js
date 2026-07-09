import gulp from 'gulp';
import cleanCSS from 'gulp-clean-css';
import htmlmin from 'gulp-html-minifier-terser'
import htmlclean from 'gulp-htmlclean'
import terser from 'gulp-terser';
// 压缩js
gulp.task('minify-js', () =>
    gulp.src(['./dist/**/*.js']) //, '!./dist/**/*.min.js'
        .pipe(terser({
            compress: {
                drop_console: true, // 删除console
                drop_debugger: true
            }
        }))
        .pipe(gulp.dest('dist'))
)
//压缩css
gulp.task('minify-css', () => {
    return gulp.src(['dist/**/*.css'])
        .pipe(cleanCSS({
            compatibility: '*'
        }))
        .pipe(gulp.dest('dist'))
});
//压缩html
gulp.task('minify-html',() => {
    return gulp.src('dist/**/*.html')
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
        .pipe(gulp.dest('dist'))
});

gulp.task('default', gulp.parallel(
    'minify-js', 'minify-css', 'minify-html'
))