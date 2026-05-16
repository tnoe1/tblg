const crypto = require('node:crypto');
const fs = require('node:fs');

function compute_checksum(file_path, hashing_alg = 'sha256') {
    return new Promise((res, rej) => {
        const hash = crypto.createHash(hashing_alg);
        const stream = fs.createReadStream(file_path);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            res(hash.digest('hex'));
        });

        stream.on('error', (err) => {
            rej(err);
        });
    });
}

module.exports = compute_checksum;
