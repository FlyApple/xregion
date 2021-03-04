"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XLoadFile = void 0;
const fs = require("fs");
const os = require("os");
const path = require("path");
const iconv = require("iconv-lite");
var XLoadFile;
(function (XLoadFile) {
    ;
    let decode_string = (buffer, length, encoding = "utf8") => {
        if (length < 0) {
            length = buffer.length;
        }
        if (encoding == "utf8") {
            return buffer.toString("utf8", 0, length);
        }
        else if (encoding == "utf16le") {
            if (iconv.encodingExists("utf-16le")) {
                return iconv.decode(buffer.subarray(0, length), "utf-16le");
            }
            return buffer.toString("utf16le", 0, length);
        }
        if (os.platform() == "win32") {
            if (iconv.encodingExists("gb2312")) {
                return iconv.decode(buffer.subarray(0, length), "gb2312");
            }
        }
        return buffer.toString("utf8", 0, length);
    };
    let indexof_line_end = (buffer, wide = 1) => {
        let index = -1;
        for (let i = 0; i < buffer.length; i += wide) {
            let v = 0;
            if (wide == 2) {
                v = (buffer[i + 0] << 0x00) | (buffer[i + 1] << 0x08);
            }
            else {
                v = buffer[i + 0];
            }
            if (v == 0x0A) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            if (wide == 2 && buffer.length >= index + 2
                && ((buffer[index + 0] << 0x00) | (buffer[index + 1] << 0x08)) == 0x0A) {
                index += 2;
            }
            else if (buffer.length >= index + 1 && buffer[index + 0] == 0x0A) {
                index += 1;
            }
        }
        return index;
    };
    XLoadFile.read_file_header = (fd, length) => {
        if (fd < 0) {
            return null;
        }
        let encoding = "utf8";
        if (os.platform() == "win32") {
            encoding = "auto";
        }
        let offset = 0;
        let buffer = Buffer.alloc(4, 0);
        if (length >= 2) {
            fs.readSync(fd, buffer, { offset: 0, length: 2, position: 0 });
            let flag = buffer.readUInt16LE();
            if (flag == 0xFEFF) {
                encoding = "utf16le";
                offset += 2;
            }
            else if (length >= 3) {
                fs.readSync(fd, buffer, { offset: 0, length: 3, position: 0 });
                flag = buffer.readUInt32LE();
                if (flag == 0x00BFBBEF) {
                    encoding = "utf8";
                    offset += 3;
                }
            }
        }
        return { encoding: encoding, offset: offset };
    };
    XLoadFile.read_line_from_file = (fd, offset, encoding = "utf8") => {
        let charwide = 1;
        if (encoding == "utf16le") {
            charwide = 2;
        }
        let block = 256;
        let value = null;
        let buffer = Buffer.alloc(block, 0);
        let result = -1;
        let ov = 0, op = offset;
        while ((result = fs.readSync(fd, buffer, { offset: ov, length: block, position: op })) > 0) {
            let index = indexof_line_end(buffer, charwide);
            if (index >= 0) {
                offset = offset + index;
                value = decode_string(buffer, index, encoding);
                break;
            }
            let temp = Buffer.alloc(buffer.length + block, 0);
            buffer.copy(temp, 0, 0);
            buffer = temp;
            ov = ov + block;
            op = op + block;
        }
        if (result <= 0 && ov > 0) {
            offset = offset + ov;
            value = decode_string(buffer, -1, encoding);
        }
        return !value ? null : { value: value.replace(/[\r|\n]/g, ""), offset: offset };
    };
    let CSV;
    (function (CSV) {
        let check_quota = (text) => {
            let count = 0;
            let pos = -1, ov = 0;
            while ((pos = text.indexOf("\"", ov)) >= 0) {
                count++;
                ov = pos + 1;
            }
            return count;
        };
        CSV.parse_fields = (text) => {
            let list = [];
            if (!text || text.length == 0) {
                return list;
            }
            let len = text.length;
            let pos = -1, ov = 0;
            let vv = "";
            while ((pos = text.indexOf(",", ov)) >= 0 || ov < len) {
                let n = pos >= 0 ? pos : len;
                let v = text.substring(ov, n).trim();
                vv = `${vv}${v}`;
                let qn = check_quota(vv);
                if (qn % 2 > 0 && v.length == 0) {
                    vv = `${vv}  `;
                }
                if (qn % 2 == 0 || n == len) {
                    if (vv.startsWith("\"") && vv.endsWith("\"")) {
                        vv = vv.substring(1, vv.length - 1);
                    }
                    list.push(vv);
                    vv = "";
                }
                ov = n + 1;
            }
            return list;
        };
        CSV.load_from_file_impl = (fd, length, data) => {
            if (fd < 0) {
                return false;
            }
            let header = XLoadFile.read_file_header(fd, length);
            if (!header) {
                return false;
            }
            let encoding = header.encoding;
            let offset = header.offset;
            let head = [];
            if (data instanceof Array) {
                head = null;
            }
            else {
                data.count = 0;
                data.list = {};
            }
            let line = null;
            let count = 0;
            while ((line = XLoadFile.read_line_from_file(fd, offset, encoding))) {
                let value = CSV.parse_fields(line.value || "");
                if (count == 0 && head) {
                    head = value;
                    for (let i = 0; i < head.length; i++) {
                        head[i] = head[i].replace(/[-| |\/]/g, "_").toLowerCase();
                    }
                }
                else if (head) {
                    let ikey = data.index || "";
                    let item = {};
                    for (let i = 0; i < head.length; i++) {
                        item = Object.assign(Object.assign({}, item), { [head[i]]: value[i] || null });
                    }
                    if (ikey.length > 0) {
                        data.list[item[ikey]] = item;
                    }
                    else {
                        data.list[count] = item;
                    }
                }
                else {
                    data.push(value);
                }
                count++;
                offset = line.offset;
            }
            if (head) {
                data.count = count - 1;
            }
            return true;
        };
    })(CSV = XLoadFile.CSV || (XLoadFile.CSV = {}));
    let TXT;
    (function (TXT) {
        let check_quota = (text) => {
            let count = 0;
            let pos = -1, ov = 0;
            while ((pos = text.indexOf("\"", ov)) >= 0) {
                count++;
                ov = pos + 1;
            }
            return count;
        };
        TXT.parse_fields = (text) => {
            let list = [];
            if (!text || text.length == 0) {
                return list;
            }
            let len = text.length;
            let pos = -1, ov = 0;
            let vv = "";
            while ((pos = text.indexOf("\t", ov)) >= 0 || ov < len) {
                let n = pos >= 0 ? pos : len;
                let v = text.substring(ov, n).trim();
                vv = `${vv}${v}`;
                let qn = check_quota(vv);
                if (qn % 2 > 0 && v.length == 0) {
                    vv = `${vv}  `;
                }
                if (qn % 2 == 0 || n == len) {
                    if (vv.startsWith("\"") && vv.endsWith("\"")) {
                        vv = vv.substring(1, vv.length - 1);
                    }
                    list.push(vv);
                    vv = "";
                }
                ov = n + 1;
            }
            return list;
        };
        TXT.load_from_file_impl = (fd, length, data) => {
            if (fd < 0) {
                return false;
            }
            let header = XLoadFile.read_file_header(fd, length);
            if (!header) {
                return false;
            }
            let encoding = header.encoding;
            let offset = header.offset;
            let head = [];
            if (data instanceof Array) {
                head = null;
            }
            else {
                data.count = 0;
                data.list = {};
            }
            let line = null;
            let count = 0;
            while ((line = XLoadFile.read_line_from_file(fd, offset, encoding))) {
                let value = TXT.parse_fields(line.value || "");
                if (count == 0 && head) {
                    head = value;
                    for (let i = 0; i < head.length; i++) {
                        head[i] = head[i].replace(/[-| |\/]/g, "_").toLowerCase();
                    }
                }
                else if (head) {
                    let ikey = data.index || "";
                    let item = {};
                    for (let i = 0; i < head.length; i++) {
                        item = Object.assign(Object.assign({}, item), { [head[i]]: value[i] || null });
                    }
                    if (ikey.length > 0) {
                        data.list[item[ikey]] = item;
                    }
                    else {
                        data.list[count] = item;
                    }
                }
                else {
                    data.push(value);
                }
                count++;
                offset = line.offset;
            }
            if (head) {
                data.count = count - 1;
            }
            return true;
        };
    })(TXT = XLoadFile.TXT || (XLoadFile.TXT = {}));
    XLoadFile.load_from_file = (mode, filename, result) => {
        let fullname = path.resolve(process.cwd(), filename);
        if (!fs.existsSync(fullname)) {
            return null;
        }
        let fd = -1;
        try {
            let stat = fs.statSync(fullname, { bigint: false });
            let length = stat.size;
            fd = fs.openSync(fullname, "r", 0o666);
            if (fd < 0) {
                return null;
            }
            let data = result;
            if (mode == "TXT") {
                if (!TXT.load_from_file_impl(fd, length, data)) {
                    fs.closeSync(fd);
                    fd = -1;
                    return null;
                }
            }
            else {
                if (!CSV.load_from_file_impl(fd, length, data)) {
                    fs.closeSync(fd);
                    fd = -1;
                    return null;
                }
            }
            fs.closeSync(fd);
            fd = -1;
            return data;
        }
        catch (e) {
            if (fd >= 0) {
                fs.closeSync(fd);
                fd = -1;
            }
            return null;
        }
    };
})(XLoadFile = exports.XLoadFile || (exports.XLoadFile = {}));
//# sourceMappingURL=xload.js.map