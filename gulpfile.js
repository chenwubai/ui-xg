var gulp = require('gulp'),
    _ = require('./misc/tasks/util'),
    html2js = require('gulp-angular-html2js'),
    eslint = require('gulp-eslint'),
    concat = require('gulp-concat'),
    insert = require('gulp-insert'),
    uglify = require('gulp-uglify'),
    cleanCss = require('gulp-clean-css'),
    rename = require('gulp-rename'),
    sass = require('gulp-sass'),
    rimraf = require('gulp-rimraf'),
    KarmaServer = require('karma').Server,
    marked = require('marked'),
    renderer = new marked.Renderer(),
    highlight = require('highlight.js'),
    ejs = require('ejs');

var config = {
    modules: [],
    srcModules: [],
    tplModules: [],
    moduleName: 'ui.xg',
    pkg: require('./package.json'),
    scene: 'scene',
    src: 'src',
    dist: 'dist',
    filename: 'ui-xg',
    repo: 'https://github.com/xgfe/ui-xg.git',
    branch: 'gh-pages'
};
config.getBanner = function () {
    var banner = [
        '/*',
        ' * ' + config.pkg.name + '',
        ' * Version: ' + config.pkg.version + ' - ' + _.formateDate() + '',
        ' * License: ' + config.pkg.license + '', ' */\n'
    ].join('\n');
    var modules = 'angular.module("' + config.moduleName +
        '", ["' + config.moduleName + '.tpls",' +
        config.srcModules.toString() + ']);\n';
    var tplmodules = 'angular.module("' + config.moduleName + '.tpls", [' +
        config.tplModules.toString() + ']);\n';

    return banner + modules + tplmodules;
};

gulp.task('eslint', function () {
    return gulp.src(
        [
            'gulpfile.js',
            'misc/tasks/util.js',
            'misc/test-lib/matchers.js',
            config.src + '/**/*.js',
            '!' + config.src + '/*/templates/*.html.js'
        ])
        .pipe(eslint())
        .pipe(eslint.formatEach())
        .pipe(eslint.failOnError());
});
/**
 * karma 执行测试用例，可单独测试某一个模块
 */
gulp.task('karma', ['html2js'], function (done) {
    new KarmaServer({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true
    }, done).start();
});
gulp.task('clean:html2js', function () {
    return gulp.src(config.src + '/**/*.html.js', {read: false})
        .pipe(rimraf());
});
/**
 * 将angular的模板文件转化为js
 */
gulp.task('html2js', function () {
    return gulp.src(config.src + '/*/templates/*.html')
        .pipe(html2js({
            moduleName: function (filename, subpath) {
                return subpath.replace(/^src\//, '');
            },
            templateUrl: function (filename) {
                return 'templates/' + filename;
            },
            rename: function (fileName) {
                return fileName + '.js';
            }
        }))
        .pipe(gulp.dest(config.src));
});
var foundModules = {};
function findModule(name) {
    if (foundModules[name]) {
        return;
    }
    foundModules[name] = true;

    function enquote(str) {
        return '"' + str + '"';
    }

    function getTplModule(str) {
        return enquote(str.replace(new RegExp('^' + config.src + '\/'), ''));
    }

    var module = {
        name: name,
        moduleName: enquote(config.moduleName + '.' + name),
        srcFiles: _.matchFile(config.src + '/' + name + '/*.js'),
        cssFiles: _.matchFile(config.src + '/' + name + '/*.css'),
        tplFiles: _.matchFile(config.src + '/' + name + '/templates/*.html'),
        tpljsFiles: _.matchFile(config.src + '/' + name + '/templates/*.html.js'),
        tplModules: _.matchFile(config.src + '/' + name + '/templates/*.html').map(getTplModule),
        dependencies: dependenciesForModule(name),
        docs: {
            md: '',
            html: '',
            js: '',
            css: ''
        }
    };
    module.hasDoc = hasDoc(name);
    if (module.hasDoc) {
        module.docs = {
            md: getDocsReadme(name),
            html: getDocsFile(name, 'index.html'),
            js: getDocsFile(name, 'script.js'),
            css: getDocsFile(name, 'style.css')
        };
    }
    module.dependencies.forEach(findModule);
    config.modules.push(module);
}
function hasDoc(name) {
    return _.isExists(config.src + '/' + name + '/docs/readme.md');
}
function getDocsReadme(name) {
    var path = config.src + '/' + name + '/docs/readme.md';
    var content = _.readFile(path, 'utf-8');
    var argumentBlock = false;
    renderer.heading = function (text, level) {
        if (level === 2 && text.toLowerCase() === 'arguments') {
            argumentBlock = true;
            return '<h2>' + text + '</h2>';
        }
        if (argumentBlock) {
            argumentBlock = false;
        }
        return '<h' + level + '>' + text + '</h' + level + '>';
    };
    var table = '<table class="table table-striped table-bordered">',
        thead = '<tr><th>Param</th><th>Type</th><th>Default</th><th>Detail</th></tr>',
        tbody = '';
    table += thead + tbody;
    renderer.list = function (body, ordered) {
        var code = body.split('\n').join(''), ulMatch, liMatch,
            ulReg = /<li>([\w\(\)]+)[:：](.+?)<ul>(.+?)<\/ul><\/li>/g,
            liReg = /<li>(\w+)[:：](.+?)<\/li>/g,
            tr = '', cols;
        if (argumentBlock && body.match('<ul>')) {
            while ((ulMatch = ulReg.exec(code))) {
                tr += '<tr>';
                tr += '<td>' + ulMatch[1] + '</td>';

                cols = {};
                while ((liMatch = liReg.exec(ulMatch[3]))) {
                    cols[liMatch[1]] = _.formatCode(liMatch[1], liMatch[2]);
                }
                tr += '<td>' + (cols.type ? cols.type : '') + '</td>';
                tr += '<td>' + (cols['default'] ? cols['default'] : '') + '</td>';
                tr += '<td>' + ulMatch[2] + '</td>';
                tr += '</tr>';
                tbody += tr;
                tr = '';
            }
            table += tbody + '</table>';
            return table;
        }
        return ordered ? '<ol>' + body + '</ol>' : '<ul>' + body + '</ul>';
    };
    marked.setOptions({
        highlight: function (code) {
            return highlight.highlightAuto(code).value.replace(/{{(.+?)}}/g, function (match, $1) {
                return '<span>&#123;&#123;</span>' + $1 + '&#125;&#125;';
            });
        }
    });
    return marked(content, {
        renderer: renderer
    });
}
function getDocsFile(name, filename) {
    var path = config.src + '/' + name + '/docs/' + filename;
    return _.readFile(path);
}
//场景组件
function getDocsFile2(name, filename) {
    var path = config.scene + '/' + name + '/' + filename;
    return _.readFile(path);
}
function dependenciesForModule(name) {
    var deps = [];
    _.matchFile(config.src + '/' + name + '/*.js').map(_.readFile).forEach(function (contents) {
        var moduleDeclIndex = contents.indexOf('angular.module(');
        var depArrayStart = contents.indexOf('[', moduleDeclIndex);
        var depArrayEnd = contents.indexOf(']', depArrayStart);
        var dependencies = contents.substring(depArrayStart + 1, depArrayEnd);
        var depName;
        dependencies.split(',').forEach(function (dep) {
            if (dep.indexOf(config.moduleName + '.') > -1) {
                depName = dep.trim().replace(config.moduleName + '.', '').replace(/['"]/g, '');
                if (deps.indexOf(depName) < 0) {
                    deps.push(depName);
                    deps = deps.concat(dependenciesForModule(depName));
                }
            }
        });
    });
    return deps;
}
/**
 * 获取所有模块
 */
gulp.task('modules', ['html2js'], function () {
    var argvs = process.argv.slice(2);
    var pos = argvs.indexOf('-m');
    var moduleNames = 'all';
    if (~pos && argvs[pos + 1]) {
        moduleNames = argvs[pos + 1].split(',').filter(function (match) {
            return match;
        });
    }
    var modulesPaths;
    if (moduleNames === 'all' || !moduleNames.length) {
        modulesPaths = config.src + '/*/';
    } else {
        modulesPaths = config.src + '/*(' + moduleNames.join('|') + ')/';
    }
    _.matchFile(modulesPaths).forEach(function (dir) {
        findModule(dir.split('/')[1]);
    });
    config.modules.forEach(function (module) {
        config.srcModules.push(module.moduleName);
        config.tplModules = config.tplModules.concat(module.tplModules);
    });
});
/**
 * 拼接js和css
 */
gulp.task('sass', function () {
    return gulp.src(config.src + '/*/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest(config.src));
});
gulp.task('concat:css', ['modules', 'sass'], function () {
    var src = config.modules.map(function (module) {
        return module.name;
    });
    if (src.length) {
        var srcPath = config.src + '/*(' + src.join('|') + ')/*.css';
        return gulp.src(srcPath)
            .pipe(concat(config.filename + '.css'))
            .pipe(gulp.dest('./' + config.dist + '/css/'));
    }
});
gulp.task('concat:js', ['modules'], function () {
    function getFileMapping() {
        var mapping = [];
        config.modules.forEach(function (module) {
            mapping = mapping.concat(module.srcFiles);
        });
        return mapping;
    }

    var srcFile = [];
    srcFile = srcFile.concat(getFileMapping());
    var tplPaths = srcFile.map(function (file) {
        return config.src + '/' + file.split('/')[1] + '/templates/*.js';
    });
    srcFile = srcFile.concat(tplPaths);
    return gulp.src(srcFile)
        .pipe(concat(config.filename + '.js'))
        .pipe(insert.transform(function (contents) {
            return config.getBanner() + contents;
        }))
        .pipe(gulp.dest('./' + config.dist + '/js'));
});
/**
 * 压缩js和css
 */
gulp.task('uglify', ['concat:css', 'concat:js'], function () {
    gulp.src([config.dist + '/css/*.css', '!' + config.dist + '/css/*.min.css'])
        .pipe(cleanCss())
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(config.dist + '/css'));

    return gulp.src([config.dist + '/js/*.js', '!' + config.dist + '/js/*.min.js'])
        .pipe(uglify({
            output: {
                comments: function (comments, token) {
                    return token.line === 1;
                }
            }
        }))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(config.dist + '/js'));
});
/**
 * 清空构建目录
 */
gulp.task('clean', function () {
    return gulp.src(config.dist, {read: false})
        .pipe(rimraf());
});
// 复制静态文件
gulp.task('copy', ['uglify'], function () {
    // copy assets
    gulp.src(['misc/assets/**/*.html', 'misc/index.html'])
        .pipe(gulp.dest(config.dist + '/docs'));

    gulp.src(['misc/assets/js/*.js'])
        .pipe(gulp.dest(config.dist + '/docs/js'));


    gulp.src([config.dist + '/js/' + config.filename + '.min.js'])
        .pipe(gulp.dest(config.dist + '/docs/js/lib'));

    // combine css files
    return gulp.src(
        [
            'misc/assets/css/github.css',
            config.dist + '/css/' + config.filename + '.min.css',
            'misc/assets/css/style.css'
        ])
        .pipe(concat('style.css'))
        .pipe(gulp.dest(config.dist + '/docs/css'));
});
// 自动构建API网站
gulp.task('docs', ['copy'], function () {
    var docPath = config.dist + '/docs/',
        tplPath = 'misc/tpl/';
    if (!_.isExists(docPath + 'partials/api')) {
        _.mkdir(docPath + 'partials/api');
    }
    if (!_.isExists(docPath + 'partials/scene')) {
        _.mkdir(docPath + 'partials/scene');
    }
    if (!_.isExists(docPath + 'api')) {
        _.mkdir(docPath + 'api');
    }
    var moduleNames = [], template, code;
    var moduleNames2 = ['list', 'CRUD'];

    config.modules.forEach(function (module) {
        if (!module.hasDoc) {
            return;
        }
        // 构建组件文档页面
        createPartial(module, docPath);
        moduleNames.push(module.name);
    });

    // 构建scene目录
    moduleNames2.forEach(function (module) {
        // 构建组件文档页面
        createScenePartial(module, docPath);
    });

    // 构建aside-scene
    template = _.readFile(tplPath + 'aside.html.tpl');
    code = ejs.render(template, {modules: moduleNames2, type: 'scene'});
    _.writeFile(docPath + 'partials/aside-scene.html', code);

    // 构建aside
    template = _.readFile(tplPath + 'aside.html.tpl');
    code = ejs.render(template, {modules: moduleNames, type: 'api'});
    _.writeFile(docPath + 'partials/aside.html', code);

    // 构建路由控制js文件
    template = _.readFile(tplPath + 'routers.js.tpl');
    code = ejs.render(template, {modules: moduleNames, modules2: moduleNames2});
    _.writeFile(docPath + 'js/routers.js', code);

    // 构建导航栏组件跳转链接
    template = _.readFile(tplPath + 'app.html.tpl');
    var firstModule = config.modules.length ? config.modules[0].name : '';
    code = ejs.render(template, {module: firstModule, module2: moduleNames2[0]});
    _.writeFile(docPath + 'partials/app.html', code);

    // 没有docs目录的话，生成
    if (!_.isExists(docPath + 'partials/docs')) {
        _.mkdir(docPath + 'partials/docs');
    }
    // 构建组件文档编写规范
    template = _.readFile(tplPath + 'start.html.tpl');
    var docsContent = _.readFile('docs/start.md');
    var appContent = marked(docsContent);
    code = ejs.render(template, {appContent: appContent});
    _.writeFile(docPath + 'partials/docs/start.html', code);

    // 构建开发者文档和组件文档编写规范
    template = _.readFile(tplPath + 'guideDocs.html.tpl');
    docsContent = _.readFile('docs/guide.md');
    appContent = marked(docsContent);
    code = ejs.render(template, {appContent: appContent});
    _.writeFile(docPath + 'partials/docs/guide.html', code);

    // 构建组件文档编写规范
    docsContent = _.readFile('docs/directive-docs.md');
    appContent = marked(docsContent);
    code = ejs.render(template, {appContent: appContent});
    _.writeFile(docPath + 'partials/docs/directiveDocs.html', code);

});

function createScenePartial(name, docPath) {

    var html = getDocsFile2(name, 'index.html'),
        js = getDocsFile2(name, 'script.js'),
        css = getDocsFile2(name, 'style.css'),
        code = '';

    var jsonFiles = _.matchFile(config.scene + '/' + name + '/*.json');

    if (jsonFiles) {
        // 构建json文件
        jsonFiles.forEach(function (item, index) {
            code = _.readFile(item);
            _.writeFile(docPath + 'api/' + name + (index + 1) + '.json', code);
            code = '';
        });
    }

    if (html) {
        code += '<h2>Example</h2>';
        code += '<style>' + css + '</style>';
        code += '<div class="example">' + html + '</div>';
        code += '<script>' + js + '</script>';
        //code += '<div>'+result+'</div>';
    }
    _.writeFile(docPath + 'partials/scene/' + name + '.html', code);
}
function createPartial(module, docPath) {
    var code = module.docs.md,
        html = module.docs.html,
        js = module.docs.js,
        css = module.docs.css,
        data = {};
    var exampleCodeTpl = _.readFile('misc/tpl/code-example.html.tpl');
    var template = ejs.compile(exampleCodeTpl);
    var htmlCode = highlight.highlightAuto(html).value.replace(/{{(.+?)}}/g, function (match, $1) {
        return '<span>&#123;&#123;</span>' + $1 + '&#125;&#125;';
    });
    var jsCode = highlight.highlightAuto(js).value;
    var cssCode = highlight.highlightAuto(css).value;


    data.html = htmlCode || '';
    data.js = jsCode || '';
    data.css = cssCode || '';
    var result = template(data);

    if (html) {
        code += '<hr><h2>Example</h2>';
        code += '<style>' + css + '</style>';
        code += '<div class="example">' + html + '</div>';
        code += '<script>' + js + '</script>';
        code += '<div>' + result + '</div>';
    }
    _.writeFile(docPath + 'partials/api/' + module.name + '.html', code);
}
// 脚手架
gulp.task('create', function () {
    var newModules = process.argv.slice(3).map(function (argv) {
        return argv.slice(1);
    });
    newModules.forEach(function (module) {
        _.createModuleFiles(module);
    });
});
gulp.task('test', ['clean:html2js', 'html2js', 'karma']);
gulp.task('build', ['clean', 'eslint', 'concat:css', 'concat:js', 'uglify']);
gulp.task('default', ['test'], function () {
    gulp.run('build');
});
