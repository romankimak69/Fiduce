const { spawn, exec } = require('child_process');
const path = require('path');
const publicPath = `${process.env.FS_PREFIX ?? '.'}/public/uploads/`
const compressPdf = async (filename) => {
    return new Promise((resolve, reject) => {
        let dpi = 120;
        let ghostScript = process.env.GSX_OPTIMIZE_COMMAND;
        let gsargs = [
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/ebook',
            '-dPreserveEPSInfo=false',
            '-dConvertCMYKImagesToRGB=true',
            '-dColorImageDownsampleThreshold=1',
            `-dColorImageResolution=${dpi}`,
            `-dMonoImageResolution=${dpi}`,
            `-dGrayImageResolution=${dpi}`,
            '-dNOPAUSE',
            '-dBATCH',
            '-dPrinted=false',
            `-sOutputFile=${path.resolve(`${publicPath}compressed/` + filename)}`,
            `${path.resolve(publicPath + filename)}`
        ]

        let optimizer = spawn(ghostScript, gsargs);
        console.log(`Compressing ${filename} --> ${filename} : ${dpi}dpi`);

        let totalPages = 1;

        optimizer.stdout.on('data', function (data) {
            let rx1 = /Processing pages 1 through (\d+)/m;
            let rx2 = /Page (\d+)/;
            let g1 = rx1.exec(data.toString());
            //let g2 = rx2.exec(data.toString());

            if (g1)
                totalPages = g1[1];
            // else if (g2) {
            //     job.reportProgress({ done: g2[1], total: totalPages });
            // }
        });

        optimizer.stderr.on('data', function (data) {
            let eobj = "";
            eobj += data.toString();
            if (eobj.includes("failed: true")) {
                console.log('stderr: ' + eobj);
                reject("Failed to compress");
            }
        });

        optimizer.on('exit', function (code) {
            let exitCode = code
            console.log('ghostscript exited with code ' + exitCode);
            if (exitCode)
                reject("Conversion error, code " + exitCode);
            else
                resolve();
        });

        optimizer.on('error', (err) => {
            console.log(err);
            reject(err);
        })
    });
}

const convertToPdf = async (filename, relPath) => {
    return new Promise((resolve, reject) => {
        let script = process.env.UNOCONV_COMMAND || 'unoconv.bat';
        let outputFileName = filename.split('.').slice(0, -1).join('.') + '.pdf';
        if (!relPath.endsWith('/')) relPath += '/';

        console.log(`Converting ${filename} --> ${outputFileName}`);

        exec(`${script} -f pdf -o "${path.resolve(relPath + outputFileName)}" "${path.resolve(relPath + filename)}"`,
            function (error, stdout, stderr) {
                if (error) return reject(error);
                resolve();
            });
    });
}

const allowedExtensionsForConvertToPdf = ['bib', 'bmp', 'csv', 'dbf', 'dif', 'doc', 'doc6', 'doc95', 'docbook', 'docx', 'docx7', 'emf', 'eps', 'fodg', 'fodp', 'fods', 'fodt', 'gif', 'html', 'jpg', 'latex', 'mediawiki', 'met', 'odd', 'odg', 'odp', 'ods', 'odt', 'ooxml', 'otg', 'otp', 'ots', 'ott', 'pbm', 'pct', 'pdb', 'pdf', 'pgm', 'png', 'pot', 'potm', 'ppm', 'pps', 'ppt', 'pptx', 'psw', 'pwp', 'pxl', 'ras', 'rtf', 'sda', 'sdc', 'sdc3', 'sdc4', 'sdd', 'sdd3', 'sdd4', 'sdw', 'sdw3', 'sdw4', 'slk', 'stc', 'std', 'sti', 'stw', 'svg', 'svm', 'swf', 'sxc', 'sxd', 'sxd3', 'sxd5', 'sxi', 'sxw', 'text', 'tiff', 'txt', 'uop', 'uos', 'uot', 'vor', 'vor3', 'vor4', 'vor5', 'wmf', 'wps', 'xhtml', 'xls', 'xls5', 'xls95', 'xlsx', 'xlt', 'xlt5', 'xlt95', 'xpm'];

module.exports = {
    compressPdf,
    convertToPdf,
    allowedExtensionsForConvertToPdf
}