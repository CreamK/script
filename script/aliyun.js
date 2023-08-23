/*
hostname = api.aliyundrive.com
[rewrite]
# 配置后，关闭阿里云盘重新进入获取refreshToken，获取后关闭脚本
^https:\/\/api.aliyundrive.com\/users\/v1\/users\/device\/create_session url script-request-body qx_pan.js

^http://(aliyun|quark|pikpak)\.example\.com url script-analyze-echo-response qx_pan.js

*/
const tk = new ToolKit(`qx_pan`, `qx_pan`, { httpApi: "" });
let url = $request.url;
let body = $request.body;
let type = url.match(/aliyun|pikpak|quark/)[0];
let debug = true;
var myResponse = {
  status: "HTTP/1.1 200 OK",
  body: "",
};
switch (type) {
  case "aliyun":
    if (url.indexOf("create_session") > 0) {
      aliyun_get_token();
    } else {
      aliyun();
    }
    break;
  case "pikpak":
    pikpak();
    break;
  case "quark":
    quark();
    break;
  default:
    $done({});
}
function aliyun_get_token() {
  let token_json = JSON.parse(body);
  $prefs.setValueForKey(token_json.refreshToken, "ali_refresh_token");
  
  tk.msg('🎉 🎉 🎉成功获取aliyun refreshToken', '', token_json.refreshToken, {'update-pasteboard': token_json.refreshToken,openUrl: "Telegram://"});
  tk.done()
}
function aliyun() {
  let jsonTk = $prefs.valueForKey("ali_token")?.split(",") || [];
  let access_token = "Bearer " + jsonTk[0];
  let refresh_token = jsonTk[1];
  let default_drive_id = jsonTk[2];
  let req = {
    url: "https://api.aliyundrive.com/adrive/v3/file/list",
    headers: {
      Authorization: access_token,
      "Content-Type": "application/json",
    },
  };
  !(async () => {
    switch (url.match(/(auth|entry)\.cgi$/)?.[0]) {
      case "auth.cgi":
        try {
          let password = $prefs.valueForKey('ali_refresh_token') || refresh_token || body.match(/passwd=([^&]*)/)[1];
          req.url = "https://auth.aliyundrive.com/v2/account/token";
          req.body = `{"refresh_token":"${password}","grant_type":"refresh_token"}`;
          let auth_json = await http(req, "post");
          let jstk = `${auth_json.access_token},${auth_json.refresh_token},${auth_json.default_drive_id}`;
          $prefs.setValueForKey(jstk, "ali_token");
          let obj = {
            success: true,
            data: {
              sid: auth_json.access_token,
            },
          };
          myResponse.body = JSON.stringify(obj);
          $done(myResponse);
          // $done({
          //   status: 200,
          //   body: `{"success":true,"data":{"sid":"${auth_json.access_token}"}}`,
          // });
        } catch (err) {
          console.log("err-" + err);
          $done();
        }
        break;
      case "entry.cgi":
        try {
          if (body.match("Delete&")) {
            let id = body.match(/path=([^&]+)/)[1];
            req.url = "https://api.aliyundrive.com/v3/batch";
            req.body = `{"resource":"file","requests":[{"method":"POST","headers":{"Content-Type":"application\/json"},"id":"${id}","body":{"file_id":"${id}","drive_id":"${default_drive_id}"},"url":"\/recyclebin\/trash"}]}`;
            $done(req);
          } else if (body.match("method=get")) {
            photo();
          } else {
            let parent_file_id = "root";
            let path = body.match(/folder_path=([^&]+)/)?.[1];
            let a = path
              ? ((req.url = req.url.replace(/(parent_id=)/, `$1${path}`)),
                (parent_file_id = path),
                "files")
              : "shares";
            let _body = {
              fields: "*",
              drive_id: default_drive_id,
              order_direction: "DESC",
              order_by: "updated_at",
              limit: 100,
              parent_file_id: parent_file_id,
              all: false,
            };
            req.body = JSON.stringify(_body);
            let shares = [];
            do {
              var { items, next_marker } = await http(req, "post");
              let data = items.map((item) => {
                return {
                  isdir: item.type === "folder",
                  path: item.file_id,
                  name: item.name,
                  additional: { size: item.size },
                  url: item.url,
                };
              });
              shares = shares.concat(data);
              if (next_marker) {
                _body.marker = next_marker;
                req.body = JSON.stringify(_body);
              }
            } while (next_marker);
            shares = JSON.stringify(shares);
            $prefs.setValueForKey(shares, "ail_file");
            $done({
              status: "HTTP/1.1 200 OK",
              body: `{"success":true,"data":{"total":0,"offset":0,"${a}":${shares}}}`,
            });
          }
        } catch (err) {
          console.log("err-" + err);
          $done();
        }
        break;
      default:
        try {
          let fileid = url.match("fbdownload")
            ? hex2str(url.match(/dlink=%22(.*)%22/)[1])
            : url.match(/path=(.*$)/)[1];
          // $request.url = JSON.parse($prefs.valueForKey("ail_file"))
          //   .filter((x) => x.path === fileid)[0]
          //   .url.replace(/https/, "http");
          // $request.headers.Referer = "https://www.aliyundrive.com/";
          // delete $request.headers.Host;
          let m3u8_url = JSON.parse($prefs.valueForKey("ail_file"))
            .filter((x) => x.path === fileid)[0]
            .url.replace(/https/, "http");
          myResponse.headers = {
            Location: m3u8_url,
            Referer: "https://www.aliyundrive.com/",
          };
          myResponse.status = "HTTP/1.1 302 OK";
          $done(myResponse);
        } catch (err) {
          console.log("err-" + err);
          $done();
        }
    }
  })().catch(() => $done());
}
function pikpak() {
  let _url = [
    "https://api-drive.mypikpak.com/drive/v1/files?filters=%7B%22phase%22%3A%7B%22eq%22%3A%22PHASE_TYPE_COMPLETE%22%7D%2C%22trashed%22%3A%7B%22eq%22%3Afalse%7D%7D",
    "",
    "&parent_id=",
    "",
    "&thumbnail_size=SIZE_LARGE",
  ];
  let req = {
    url: _url.join(""),
    headers: { authorization: $prefs.valueForKey("pikpak-ck") },
  };
  !(async () => {
    switch (url.match(/(auth|entry)\.cgi$/)?.[0]) {
      case "auth.cgi":
        body = decodeURIComponent(body);
        let username = body.match(/account=([^&]+)/)[1];
        let password = body.match(/passwd=([^&]+)/)[1];
        let token =
          "Bearer " +
          (
            await http(
              {
                url: "https://user.mypikpak.com/v1/auth/signin",
                body: `{"client_id":"YNxT9w7GMdWvEOKa","username":"${username}","password":"${password}"}`,
              },
              "post"
            )
          )?.["access_token"];
        $prefs.setValueForKey(token, `pikpak-ck`);
        $done({
          status: 200,
          body: `{"success":true,"data":{"sid":"${token}"}}`,
        });
        break;
      case "entry.cgi":
        if (body.match("Delete&")) {
          req.url = "https://api-drive.mypikpak.com/drive/v1/files:batchTrash";
          req.body = `{"ids":["${body.match(/path=([^&]+)/)[1]}"]}`;
          $done(req);
        } else if (body.match("method=get")) {
          photo();
        } else {
          let path = body.match(/folder_path=([^&]+)/)?.[1];
          let a = path ? ((_url[3] = path), "files") : "shares";
          let shares = [];
          do {
            req.url = _url.join("");
            var { files, next_page_token } = await http(req);
            let data = files.map((item) => {
              return {
                isdir: !item.file_extension,
                path: item.id,
                name: item.name,
                additional: { size: parseInt(item.size) },
              };
            });
            if (next_page_token) {
              _url[1] = "&page_token=" + next_page_token;
            }
            shares = shares.concat(data);
          } while (next_page_token);
          $done({
            response: {
              status: 200,
              body: JSON.stringify({
                success: true,
                data: { total: 0, offset: 0, [a]: shares },
              }),
            },
          });
        }
        break;
      default:
        let fids = url.match("fbdownload")
          ? hex2str(url.match(/dlink=%22(.*)%22/)[1])
          : url.match(/path=(.*$)/)[1];
        req.url = `https://api-drive.mypikpak.com/drive/v1/files/${fids}?&thumbnail_size=SIZE_LARGE`;
        link = (await http(req)).links["application/octet-stream"].url.replace(
          /https/,
          "http"
        );
        $done({ status: 302, headers: { Location: link } });
    }
  })().catch(() => $done());
}
function quark() {
  let ck = $prefs.valueForKey("quark-ck");
  let _url = [
    "https://drive.quark.cn/1/clouddrive/file/sort?_fetch_total=1&_page=",
    "1",
    "&_size=100&fr=pc&pdir_fid=",
    0,
    "&pr=ucpro",
  ];
  let req = {
    url: _url.join(""),
    headers: { cookie: ck, "content-type": "application/json" },
  };
  !(async () => {
    switch (url.match(/(auth|entry)\.cgi$/)?.[0]) {
      case "auth.cgi":
        ck = decodeURIComponent(body.match(/passwd=([^&]+)/)[1]);
        $prefs.setValueForKey(ck, "quark-ck");
        $done({
          status: 200,
          body: `{"success":true,"data":{"sid":"${ck}"}}`,
        });
        break;
      case "entry.cgi":
        if (body.match("Delete&")) {
          req.url =
            "https://drive.quark.cn/1/clouddrive/file/delete?fr=pc&pr=ucpro";
          req.body = `{"action_type":1,"exclude_fids":[],"filelist":["${
            body.match(/path=([^&]+)/)[1]
          }"]}`;
          $done(req);
        } else if (body.match("method=get")) {
          photo();
        } else {
          let path = body.match(/folder_path=([^&]+)/)?.[1];
          let a = path ? ((_url[3] = path), "files") : "shares";
          let shares = [];
          do {
            req.url = _url.join("");
            var {
              metadata: { _total },
              data: { list },
            } = await http(req, "get", 1, ck);
            let data = list.map((item) => {
              return {
                isdir: !item.file,
                path: item.fid,
                name: item.file_name,
                additional: { size: item.size },
              };
            });
            shares = shares.concat(data);
          } while (_url[1] < parseInt(_total / 100) + 1 && _url[1]++);
          $done({
            status: 200,
            body: JSON.stringify({
              success: true,
              data: { total: 0, offset: 0, [a]: shares },
            }),
          });
        }
        break;
      default:
        let fids = url.match("fbdownload")
          ? hex2str(url.match(/dlink=%22(.*)%22/)[1])
          : url.match(/path=(.*$)/)[1];
        req.url =
          "http://drive.quark.cn/1/clouddrive/file/download?fr=pc&pr=ucpro";
        req.body = `{"fids":["${fids}"]}`;
        let link = (await http(req, "post")).data[0].download_url.replace(
          /https/,
          "http"
        );
        $request.url = link;
        $request.headers.cookie = ck;
        delete $request.headers.Host;
        $done($request);
    }
  })().catch(() => $done());
}
function photo() {
  $done({
    response: {
      method: "GET",
      status: 301,
      headers: {
        Location: `http://${type}.example.com:5000/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&mode=open&path=${
          body.match(/path=([^&?]+)/)[1]
        }`,
      },
    },
  });
}
function hex2str(hex) {
  try {
    var trimedStr = hex.trim();
    var rawStr =
      trimedStr.substr(0, 2).toLowerCase() === "0x"
        ? trimedStr.substr(2)
        : trimedStr;
    var len = rawStr.length;
    if (len % 2 !== 0) {
      return "";
    }
    var curCharCode;
    var resultStr = [];
    for (var i = 0; i < len; i = i + 2) {
      curCharCode = parseInt(rawStr.substr(i, 2), 16);
      resultStr.push(String.fromCharCode(curCharCode));
    }
    return resultStr.join("");
  } catch (error) {
    console.log(error);
    return "";
  }
}
function http(req, method = "get", set, ck) {
  req["method"] = method;
  try {
    return new Promise((res, jct) => {
      $task.fetch(req).then((resp) => {
        try {
          set &&
            (set = resp.headers?.["Set-Cookie"]?.split(";")[0]) &&
            $prefs.setValueForKey(ck.replace(/[^;]+/, set), "quark-ck");
          resp?.statusCode === 200 ? res(JSON.parse(resp.body)) : jct();
        } catch (error) {
          console.log("error " + error);
          return jct();
        }
      });
    });
  } catch (error) {
    return new Promise((res) => {
      res();
    });
  }
}

function llog(r) {
  if (!debug) {
    return;
  }
  if (r == null) {
    console.log("null");
  } else if (typeof r == "string") {
    console.log(r);
  } else {
    console.log(JSON.stringify(r));
  }
}

// https://github.com/chavyleung/scripts/blob/master/Env.js
// prettier-ignore
function Env(name, opts) {
    class Http {
      constructor(env) {
        this.env = env;
      }
  
      send(opts, method = 'GET') {
        opts = typeof opts === 'string' ? { url: opts } : opts;
        let sender = this.get;
        if (method === 'POST') {
          sender = this.post;
        }
        return new Promise((resolve, reject) => {
          sender.call(this, opts, (err, resp, body) => {
            if (err) reject(err);
            else resolve(resp);
          });
        });
      }
  
      get(opts) {
        return this.send.call(this.env, opts);
      }
  
      post(opts) {
        return this.send.call(this.env, opts, 'POST');
      }
    }
  
    return new (class {
      constructor(name, opts) {
        this.name = name;
        this.http = new Http(this);
        this.data = null;
        this.dataFile = 'box.dat';
        this.logs = [];
        this.isMute = false;
        this.isNeedRewrite = false;
        this.logSeparator = '\n';
        this.startTime = new Date().getTime();
        Object.assign(this, opts);
        this.log('', `🔔${this.name}, 开始!`);
      }
  
      isNode() {
        return 'undefined' !== typeof module && !!module.exports;
      }
  
      isQuanX() {
        return 'undefined' !== typeof $task;
      }
  
      isSurge() {
        return 'undefined' !== typeof $httpClient && 'undefined' === typeof $loon;
      }
  
      isLoon() {
        return 'undefined' !== typeof $loon;
      }
  
      isShadowrocket() {
        return 'undefined' !== typeof $rocket;
      }
  
      toObj(str, defaultValue = null) {
        try {
          return JSON.parse(str);
        } catch {
          return defaultValue;
        }
      }
  
      toStr(obj, defaultValue = null) {
        try {
          return JSON.stringify(obj);
        } catch {
          return defaultValue;
        }
      }
  
      getJson(key, defaultValue) {
        let json = defaultValue;
        const val = this.getData(key);
        if (val) {
          try {
            json = JSON.parse(this.getData(key));
          } catch {}
        }
        return json;
      }
  
      setJson(val, key) {
        try {
          return this.setData(JSON.stringify(val), key);
        } catch {
          return false;
        }
      }
  
      getScript(url) {
        return new Promise((resolve) => {
          this.get({ url }, (err, resp, body) => resolve(body));
        });
      }
  
      runScript(script, runOpts) {
        return new Promise((resolve) => {
          let httpApi = this.getData('@chavy_boxjs_userCfgs.httpApi');
          httpApi = httpApi ? httpApi.replace(/\n/g, '').trim() : httpApi;
          let httpApi_timeout = this.getData(
            '@chavy_boxjs_userCfgs.httpApi_timeout'
          );
          httpApi_timeout = httpApi_timeout ? httpApi_timeout * 1 : 20;
          httpApi_timeout =
            runOpts && runOpts.timeout ? runOpts.timeout : httpApi_timeout;
          const [key, addr] = httpApi.split('@');
          const opts = {
            url: `http://${addr}/v1/scripting/evaluate`,
            body: {
              script_text: script,
              mock_type: 'cron',
              timeout: httpApi_timeout,
            },
            headers: { 'X-Key': key, Accept: '*/*' },
          };
          this.post(opts, (err, resp, body) => resolve(body));
        }).catch((e) => this.logErr(e));
      }
  
      loadData() {
        if (this.isNode()) {
          this.fs = this.fs ? this.fs : require('fs');
          this.path = this.path ? this.path : require('path');
          const curDirDataFilePath = this.path.resolve(this.dataFile);
          const rootDirDataFilePath = this.path.resolve(
            process.cwd(),
            this.dataFile
          );
          const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
          const isRootDirDataFile =
            !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
          if (isCurDirDataFile || isRootDirDataFile) {
            const datPath = isCurDirDataFile
              ? curDirDataFilePath
              : rootDirDataFilePath;
            try {
              return JSON.parse(this.fs.readFileSync(datPath));
            } catch (e) {
              return {};
            }
          } else return {};
        } else return {};
      }
  
      writeData() {
        if (this.isNode()) {
          this.fs = this.fs ? this.fs : require('fs');
          this.path = this.path ? this.path : require('path');
          const curDirDataFilePath = this.path.resolve(this.dataFile);
          const rootDirDataFilePath = this.path.resolve(
            process.cwd(),
            this.dataFile
          );
          const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
          const isRootDirDataFile =
            !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
          const jsonData = JSON.stringify(this.data);
          if (isCurDirDataFile) {
            this.fs.writeFileSync(curDirDataFilePath, jsonData);
          } else if (isRootDirDataFile) {
            this.fs.writeFileSync(rootDirDataFilePath, jsonData);
          } else {
            this.fs.writeFileSync(curDirDataFilePath, jsonData);
          }
        }
      }
  
      lodash_get(source, path, defaultValue = undefined) {
        const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let result = source;
        for (const p of paths) {
          result = Object(result)[p];
          if (result === undefined) {
            return defaultValue;
          }
        }
        return result;
      }
  
      lodash_set(obj, path, value) {
        if (Object(obj) !== obj) return obj;
        if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
        path
          .slice(0, -1)
          .reduce(
            (a, c, i) =>
              Object(a[c]) === a[c]
                ? a[c]
                : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}),
            obj
          )[path[path.length - 1]] = value;
        return obj;
      }
  
      getData(key) {
        let val = this.getVal(key);
        // 如果以 @
        if (/^@/.test(key)) {
          const [, objKey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
          const objVal = objKey ? this.getVal(objKey) : '';
          if (objVal) {
            try {
              const objedVal = JSON.parse(objVal);
              val = objedVal ? this.lodash_get(objedVal, paths, '') : val;
            } catch (e) {
              val = '';
            }
          }
        }
        return val;
      }
  
      setData(val, key) {
        let isSuc = false;
        if (/^@/.test(key)) {
          const [, objKey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
          const objdat = this.getVal(objKey);
          const objVal = objKey
            ? objdat === 'null'
              ? null
              : objdat || '{}'
            : '{}';
          try {
            const objedVal = JSON.parse(objVal);
            this.lodash_set(objedVal, paths, val);
            isSuc = this.setVal(JSON.stringify(objedVal), objKey);
          } catch (e) {
            const objedVal = {};
            this.lodash_set(objedVal, paths, val);
            isSuc = this.setVal(JSON.stringify(objedVal), objKey);
          }
        } else {
          isSuc = this.setVal(val, key);
        }
        return isSuc;
      }
  
      getVal(key) {
        if (this.isSurge() || this.isLoon()) {
          return $persistentStore.read(key);
        } else if (this.isQuanX()) {
          return $prefs.valueForKey(key);
        } else if (this.isNode()) {
          this.data = this.loadData();
          return this.data[key];
        } else {
          return (this.data && this.data[key]) || null;
        }
      }
  
      setVal(val, key) {
        if (this.isSurge() || this.isLoon()) {
          return $persistentStore.write(val, key);
        } else if (this.isQuanX()) {
          return $prefs.setValueForKey(val, key);
        } else if (this.isNode()) {
          this.data = this.loadData();
          this.data[key] = val;
          this.writeData();
          return true;
        } else {
          return (this.data && this.data[key]) || null;
        }
      }
  
      initGotEnv(opts) {
        this.got = this.got ? this.got : require('got');
        this.ckTough = this.ckTough ? this.ckTough : require('tough-cookie');
        this.ckJar = this.ckJar ? this.ckJar : new this.ckTough.CookieJar();
        if (opts) {
          opts.headers = opts.headers ? opts.headers : {};
          if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
            opts.cookieJar = this.ckJar;
          }
        }
      }
  
      get(opts, callback = () => {}) {
        if (opts.headers) {
          delete opts.headers['Content-Type'];
          delete opts.headers['Content-Length'];
        }
        if (this.isSurge() || this.isLoon()) {
          if (this.isSurge() && this.isNeedRewrite) {
            opts.headers = opts.headers || {};
            Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false });
          }
          $httpClient.get(opts, (err, resp, body) => {
            if (!err && resp) {
              resp.body = body;
              resp.statusCode = resp.status;
            }
            callback(err, resp, body);
          });
        } else if (this.isQuanX()) {
          if (this.isNeedRewrite) {
            opts.opts = opts.opts || {};
            Object.assign(opts.opts, { hints: false });
          }
          $task.fetch(opts).then(
            (resp) => {
              const { statusCode: status, statusCode, headers, body } = resp;
              callback(null, { status, statusCode, headers, body }, body);
            },
            (err) => callback(err)
          );
        } else if (this.isNode()) {
          this.initGotEnv(opts);
          this.got(opts)
            .on('redirect', (resp, nextOpts) => {
              try {
                if (resp.headers['set-cookie']) {
                  const ck = resp.headers['set-cookie']
                    .map(this.ckTough.Cookie.parse)
                    .toString();
                  if (ck) {
                    this.ckJar.setCookieSync(ck, null);
                  }
                  nextOpts.cookieJar = this.ckJar;
                }
              } catch (e) {
                this.logErr(e);
              }
              // this.ckJar.setCookieSync(resp.headers['set-cookie'].map(Cookie.parse).toString())
            })
            .then(
              (resp) => {
                const { statusCode: status, statusCode, headers, body } = resp;
                callback(null, { status, statusCode, headers, body }, body);
              },
              (err) => {
                const { message: error, response: resp } = err;
                callback(error, resp, resp && resp.body);
              }
            );
        }
      }
  
      post(opts, callback = () => {}) {
        const method = opts.method ? opts.method.toLocaleLowerCase() : 'post';
        // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
        if (opts.body && opts.headers && !opts.headers['Content-Type']) {
          opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        if (opts.headers) delete opts.headers['Content-Length'];
        if (this.isSurge() || this.isLoon()) {
          if (this.isSurge() && this.isNeedRewrite) {
            opts.headers = opts.headers || {};
            Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false });
          }
          $httpClient[method](opts, (err, resp, body) => {
            if (!err && resp) {
              resp.body = body;
              resp.statusCode = resp.status;
            }
            callback(err, resp, body);
          });
        } else if (this.isQuanX()) {
          opts.method = method;
          if (this.isNeedRewrite) {
            opts.opts = opts.opts || {};
            Object.assign(opts.opts, { hints: false });
          }
          $task.fetch(opts).then(
            (resp) => {
              const { statusCode: status, statusCode, headers, body } = resp;
              callback(null, { status, statusCode, headers, body }, body);
            },
            (err) => callback(err)
          );
        } else if (this.isNode()) {
          this.initGotEnv(opts);
          const { url, ..._opts } = opts;
          this.got[method](url, _opts).then(
            (resp) => {
              const { statusCode: status, statusCode, headers, body } = resp;
              callback(null, { status, statusCode, headers, body }, body);
            },
            (err) => {
              const { message: error, response: resp } = err;
              callback(error, resp, resp && resp.body);
            }
          );
        }
      }
      /**
       *
       * 示例:$.time('yyyy-MM-dd qq HH:mm:ss.S')
       *    :$.time('yyyyMMddHHmmssS')
       *    y:年 M:月 d:日 q:季 H:时 m:分 s:秒 S:毫秒
       *    其中y可选0-4位占位符、S可选0-1位占位符，其余可选0-2位占位符
       * @param {string} fmt 格式化参数
       * @param {number} 可选: 根据指定时间戳返回格式化日期
       *
       */
      time(fmt, ts = null) {
        const date = ts ? new Date(ts) : new Date();
        let o = {
          'M+': date.getMonth() + 1,
          'd+': date.getDate(),
          'H+': date.getHours(),
          'm+': date.getMinutes(),
          's+': date.getSeconds(),
          'q+': Math.floor((date.getMonth() + 3) / 3),
          S: date.getMilliseconds(),
        };
        if (/(y+)/.test(fmt))
          fmt = fmt.replace(
            RegExp.$1,
            (date.getFullYear() + '').substr(4 - RegExp.$1.length)
          );
        for (let k in o)
          if (new RegExp('(' + k + ')').test(fmt))
            fmt = fmt.replace(
              RegExp.$1,
              RegExp.$1.length == 1
                ? o[k]
                : ('00' + o[k]).substr(('' + o[k]).length)
            );
        return fmt;
      }
  
      /**
       * 系统通知
       *
       * > 通知参数: 同时支持 QuanX 和 Loon 两种格式, EnvJs根据运行环境自动转换, Surge 环境不支持多媒体通知
       *
       * 示例:
       * $.msg(title, subt, desc, 'twitter://')
       * $.msg(title, subt, desc, { 'open-url': 'twitter://', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
       * $.msg(title, subt, desc, { 'open-url': 'https://bing.com', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
       *
       * @param {*} title 标题
       * @param {*} subt 副标题
       * @param {*} desc 通知详情
       * @param {*} opts 通知参数
       *
       */
      msg(title = name, subt = '', desc = '', opts) {
        const toEnvOpts = (rawOpts) => {
          if (!rawOpts) return rawOpts;
          if (typeof rawOpts === 'string') {
            if (this.isLoon()) return rawOpts;
            else if (this.isQuanX()) return { 'open-url': rawOpts };
            else if (this.isSurge()) return { url: rawOpts };
            else return undefined;
          } else if (typeof rawOpts === 'object') {
            if (this.isLoon()) {
              let openUrl = rawOpts.openUrl || rawOpts.url || rawOpts['open-url'];
              let mediaUrl = rawOpts.mediaUrl || rawOpts['media-url'];
              return { openUrl, mediaUrl };
            } else if (this.isQuanX()) {
              let openUrl = rawOpts['open-url'] || rawOpts.url || rawOpts.openUrl;
              let mediaUrl = rawOpts['media-url'] || rawOpts.mediaUrl;
              let updatePasteboard =
                rawOpts['update-pasteboard'] || rawOpts.updatePasteboard;
              return {
                'open-url': openUrl,
                'media-url': mediaUrl,
                'update-pasteboard': updatePasteboard,
              };
            } else if (this.isSurge()) {
              let openUrl = rawOpts.url || rawOpts.openUrl || rawOpts['open-url'];
              return { url: openUrl };
            }
          } else {
            return undefined;
          }
        };
        if (!this.isMute) {
          if (this.isSurge() || this.isLoon()) {
            $notification.post(title, subt, desc, toEnvOpts(opts));
          } else if (this.isQuanX()) {
            $notify(title, subt, desc, toEnvOpts(opts));
          }
        }
        if (!this.isMuteLog) {
          let logs = ['', '==============📣系统通知📣=============='];
          logs.push(title);
          subt ? logs.push(subt) : '';
          desc ? logs.push(desc) : '';
          console.log(logs.join('\n'));
          this.logs = this.logs.concat(logs);
        }
      }
  
      log(...logs) {
        if (logs.length > 0) {
          this.logs = [...this.logs, ...logs];
        }
        console.log(logs.join(this.logSeparator));
      }
  
      logErr(err, msg) {
        const isPrintSack = !this.isSurge() && !this.isQuanX() && !this.isLoon();
        if (!isPrintSack) {
          this.log('', `❗️${this.name}, 错误!`, err);
        } else {
          this.log('', `❗️${this.name}, 错误!`, err.stack);
        }
      }
  
      wait(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
      }
  
      done(val = {}) {
        const endTime = new Date().getTime();
        const costTime = (endTime - this.startTime) / 1000;
        this.log('', `🔔${this.name}, 结束! 🕛 ${costTime} 秒`);
        this.log();
        if (this.isSurge() || this.isQuanX() || this.isLoon()) {
          $done(val);
        }
      }
    })(name, opts);
  }
  