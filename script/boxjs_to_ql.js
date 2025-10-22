/**
 *@file       boxjs_to_ql
 *@desp       boxjs同步环境变量到多个青龙面板。
 *@env        @ql.sync_env__key, @ql.ip, @ql.port, @ql.client_id, @ql.client_secret, @ql.mute
 *@author     WowYiJiu & Gemini
 *@updated    2025-07-31
 *@link       https://raw.githubusercontent.com/fly818/QX/refs/heads/master/Script/boxjs_to_ql.js
 *@thanks     @dompling: https://github.com/dompling

💬 BoxJs订阅:
   https://raw.githubusercontent.com/fly818/QX/refs/heads/master/boxjs/fly818.boxjs.json

   配置项说明:
   - 支持多面板, 在 IP/端口/ID/Secret 输入框中用@分隔多个值。
   - 支持通用配置, 若端口/ID/Secret相同, 只需填写一个通用值。

⚙ 配置 (Quantumult X)
[task_local]
0 0 * * * <YOUR_SCRIPT_URL>, tag=boxjs多面板同步, img-url=https://raw.githubusercontent.com/WowYiJiu/Personal/main/icon/Color/ql.png, enabled=true
*/

// 初始化一个API实例，用于后续的网络请求、数据读写等操作
const $ = new API("ql_multi_sync", true);

// 定义通知的标题
const title = "🐉 通知提示";

// 封装一个函数，用于根据不同环境（如Quantumult X）从BoxJs读取数据
$.getval = (t) => ($.env.isQX ? $prefs.valueForKey(t) : $persistentStore.read(t));

// 封装一个更高级的函数，用于获取数据，支持从JSON对象中通过路径获取值
$.getdata = (t) => {
    const lodash_get = (t, s = "", e) => s.split(/[\.\[\]]/g).filter(Boolean).reduce((res, key) => (res !== null && res !== undefined) ? res[key] : res, t) || e;
    let s = $.getval(t);
    if (/^@/.test(t)) {
        const [, e, i] = /^@(.*)\.(.*?)$/.exec(t);
        const r = e ? $.getval(e) : "";
        if (r) {
            try {
                const t = JSON.parse(r);
                s = t ? lodash_get(t, i, "") : s
            } catch (error) {
                s = ""
            }
        }
    }
    return s
};


/**
 * ----------------------------------------------------------------
 * 集成并重构后的青龙API模块 (QinglongAPI Class)
 * ----------------------------------------------------------------
 */
class QinglongAPI {
    constructor(ip, port, clientId, clientSecret) {
        this.ip = ip;
        this.port = port;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        // 增强URL处理，兼容用户可能输入 http/https 前缀的情况
        if (ip.startsWith('http')) {
            this.url = `${ip}:${port}`;
        } else {
            this.url = `http://${ip}:${port}`;
        }
        this.token = "";
        this.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json;charset=UTF-8"
        };
        $.info(`初始化面板实例: ${this.url}`);
    }

    async login() {
        const opt = {
            url: `${this.url}/open/auth/token?client_id=${this.clientId}&client_secret=${this.clientSecret}`,
            headers: this.headers,
        };
        const resp = await $.http.get(opt);
        try {
            const data = JSON.parse(resp.body);
            if (data.code === 200 && data.data.token) {
                this.token = data.data.token;
                this.headers['Authorization'] = `Bearer ${this.token}`;
                $.log(`✅ [${this.ip}] 登录成功`);
                return true;
            } else {
                $.error(`❌ [${this.ip}] 登录失败: ${data.message || '返回数据格式不正确'}`);
                return false;
            }
        } catch (e) {
            $.error(`❌ [${this.ip}] 登录请求失败: ${e}`);
            return false;
        }
    }

    async getEnvs(searchValue = "") {
        const opt = {
            url: `${this.url}/open/envs?searchValue=${searchValue}`,
            headers: this.headers,
        };
        const resp = await $.http.get(opt);
        try {
            return JSON.parse(resp.body);
        } catch (e) {
            return { code: 500, message: `获取环境变量失败: ${e}` };
        }
    }

    async addEnvs(envs) {
        const opt = {
            url: `${this.url}/open/envs`,
            headers: this.headers,
            body: JSON.stringify(envs)
        };
        const resp = await $.http.post(opt);
        try {
            return JSON.parse(resp.body);
        } catch (e) {
            return { code: 500, message: `新增环境变量失败: ${e}` };
        }
    }

    async updateEnv(env) {
        const body = {
            name: env.name,
            value: env.value,
            remarks: env.remarks,
            id: env.id
        };
        const opt = {
            url: `${this.url}/open/envs`,
            headers: this.headers,
            body: JSON.stringify(body)
        };
        const resp = await $.http.put(opt);
        try {
            return JSON.parse(resp.body);
        } catch (e) {
            return { code: 500, message: `更新环境变量失败: ${e}` };
        }
    }
}


/**
 * ----------------------------------------------------------------
 * 主执行函数
 * ----------------------------------------------------------------
 */
!(async () => {
    // 1. 读取并解析多面板配置
    $.info("==> 步骤 1: 读取面板配置");
    const ips = ($.getdata('@ql.ip') || "").split('@').filter(Boolean);
    const ports = ($.getdata('@ql.port') || "").split('@').filter(Boolean);
    const clientIds = ($.getdata('@ql.client_id') || "").split('@').filter(Boolean);
    const clientSecrets = ($.getdata('@ql.client_secret') || "").split('@').filter(Boolean);

    const servers = [];
    for (let i = 0; i < ips.length; i++) {
        // 智能处理配置: 使用索引为i的值,如果不存在,则使用第一个值作为通用值
        const port = ports[i] || ports[0];
        const clientId = clientIds[i] || clientIds[0];
        const clientSecret = clientSecrets[i] || clientSecrets[0];

        if (ips[i] && port && clientId && clientSecret) {
            servers.push({
                ip: ips[i],
                port: port,
                clientId: clientId,
                clientSecret: clientSecret
            });
        }
    }

    if (servers.length === 0) {
         return $.notify(title, "❌ 配置错误", "未找到任何有效的青龙面板配置，请检查BoxJs中的配置是否完整。");
    }
    $.info(`共发现 ${servers.length} 个面板配置。`);

    // 2. 读取并解析环境变量同步规则
    $.info("\n==> 步骤 2: 读取同步规则");
    const envKeys = $.getdata("@ql.sync_env__key") || "";
    const syncEnvs = [];
    const envsData = envKeys.split('\n');

    for (const line of envsData) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        if (trimmedLine.startsWith('-')) {
            $.log(`规则 [${trimmedLine}] 已禁用，跳过。`);
            continue;
        }
        const parts = trimmedLine.split('#');
        if (parts.length < 3) {
            $.log(`规则格式不正确，跳过: "${trimmedLine}"`);
            continue;
        }
        syncEnvs.push({ 'BoxJsKey': parts[0], 'qlEnv': parts[1], 'qlRemark': parts[2] });
    }
    $.info(`共发现 ${syncEnvs.length} 个有效的同步规则。`);


    // 3. 获取所有需要同步的变量值
    $.info("\n==> 步骤 3: 准备本地变量数据");
    const syncData = {};
    const validate = (value, pattern) => new RegExp(pattern).test(value);

    for (const item of syncEnvs) {
        if (!validate(item.qlEnv, '^[a-zA-Z_][0-9a-zA-Z_]*$')) {
            $.error(`${item.qlRemark}：${item.qlEnv} 环境变量名格式不正确, 本次不同步`);
            continue;
        }
        const qlValue = $.getdata(item.BoxJsKey) || "";
        if (!qlValue) {
            $.log(`[${item.qlRemark}] 的值为空，跳过。`);
            continue;
        }
        syncData[item.BoxJsKey] = {
            name: item.qlEnv,
            value: qlValue,
            remarks: item.qlRemark,
        };
    }

    const qlData = Object.values(syncData);
    if (qlData.length === 0) {
        return $.notify(title, "同步完成", "没有需要同步的有效环境变量。");
    }
    $.info(`成功准备 ${qlData.length} 个待同步的变量数据。`);

    // 4. 遍历所有服务器，执行同步操作
    $.info("\n==> 步骤 4: 开始同步至面板");
    let finalNotifyBodyParts = [];
    let failedPanels = [];

    for (const server of servers) {
        $.info(`\n---------- 开始处理面板 [${server.ip}] ----------`);
        const ql = new QinglongAPI(server.ip, server.port, server.clientId, server.clientSecret);
        let panelResult = [`面板 [${ql.url}]`];

        if (!(await ql.login())) {
            failedPanels.push(server.ip);
            panelResult.push("  - ❌ 登录失败，跳过此面板");
            finalNotifyBodyParts.push(panelResult.join('\n'));
            $.info(`---------- 面板 [${server.ip}] 处理完毕 ----------`);
            continue;
        }

        const envsToUpdate = [];
        const envsToAdd = [];
        const unchangedEnvs = [];

        for (const element of qlData) {
            $.log(`  -> 正在检查变量 [${element.remarks}] (${element.name})`);
            const response = await ql.getEnvs(element.name);
            const existingEnv = response.data ? response.data.find(item => item.name === element.name) : null;

            if (existingEnv) {
                let diffs = [];
                if (existingEnv.value !== element.value) diffs.push("值");
                if (existingEnv.remarks !== element.remarks) diffs.push("备注");

                if (diffs.length > 0) {
                    $.log(`     - 发现差异: ${diffs.join('和')}不同。已加入更新列表。`);
                    envsToUpdate.push({ ...element, id: existingEnv.id });
                } else {
                    $.log(`     - 值与备注均相同，无需操作。`);
                    unchangedEnvs.push(element);
                }
            } else {
                $.log(`     - 面板中不存在此变量，已加入新增列表。`);
                envsToAdd.push(element);
            }
        }

        // 执行更新和新增
        if (envsToUpdate.length > 0) {
            $.info(`  -> 检测到 ${envsToUpdate.length} 个变量需要更新...`);
            for (const env of envsToUpdate) { await ql.updateEnv(env); }
        }
        if (envsToAdd.length > 0) {
            $.info(`  -> 检测到 ${envsToAdd.length} 个变量需要新增...`);
            await ql.addEnvs(envsToAdd);
        }

        // 构造当前面板的通知内容
        if (envsToUpdate.length === 0 && envsToAdd.length === 0) {
            if (unchangedEnvs.length > 0) {
                panelResult.push(`  - ✅ 无需操作：所有 ${unchangedEnvs.length} 个变量均是最新状态。`);
            } else {
                panelResult.push(`  - ✅ 无需同步任何变量。`);
            }
        } else {
            let summaryParts = [];
            if (envsToUpdate.length > 0) summaryParts.push(`更新 ${envsToUpdate.length} 条`);
            if (envsToAdd.length > 0) summaryParts.push(`新增 ${envsToAdd.length} 条`);
            if (unchangedEnvs.length > 0) summaryParts.push(`${unchangedEnvs.length} 条已最新`);
            panelResult.push(`  - ℹ️  ${summaryParts.join('，')}。`);
        }

        const updatedDetails = envsToUpdate.map(e => `  - 🔄[更新] ${e.remarks} (${e.name})`).join('\n');
        const addedDetails = envsToAdd.map(e => `  - ➕[新增] ${e.remarks} (${e.name})`).join('\n');
        const unchangedDetails = unchangedEnvs.map(e => `  - ✅[最新] ${e.remarks} (${e.name})`).join('\n');

        const details = [updatedDetails, addedDetails, unchangedDetails].filter(Boolean).join('\n');
        if (details) {
            panelResult.push(details);
        }

        finalNotifyBodyParts.push(panelResult.join('\n'));
        $.info(`---------- 面板 [${server.ip}] 处理完毕 ----------`);
    }

    // 5. 发送最终的汇总通知
    $.info("\n==> 步骤 5: 构造并发送通知");

    let notifySubtitle = '同步任务执行完毕';
    let notifyBody = finalNotifyBodyParts.join('\n\n');

    if (failedPanels.length > 0) {
        notifyBody += `\n\n❌[失败面板]\n${failedPanels.join('\n')}`;
    }

    if ($.getdata("@ql.mute") !== "true") {
        $.notify(title, notifySubtitle, notifyBody);
    } else {
        $.info("已开启静音模式，不发送通知。");
    }

})().catch((e) => $.error(e)).finally(() => $.done());


/* prettier-ignore */
// 以下是通用的跨平台脚本运行环境兼容库，由作者提供，无需修改。
function ENV(){const isJSBox=typeof require=="function"&&typeof $jsbox!="undefined";return{isQX:typeof $task!=="undefined",isLoon:typeof $loon!=="undefined",isSurge:typeof $httpClient!=="undefined"&&typeof $utils!=="undefined",isBrowser:typeof document!=="undefined",isNode:typeof require=="function"&&!isJSBox,isJSBox,isRequest:typeof $request!=="undefined",isScriptable:typeof importModule!=="undefined",isShadowrocket:"undefined"!==typeof $rocket,isStash:"undefined"!==typeof $environment&&$environment["stash-version"],}}
/* prettier-ignore */
function HTTP(defaultOptions={baseURL:""}){const{isQX,isLoon,isSurge,isScriptable,isNode,isBrowser,isShadowrocket,isStash,}=ENV();const methods=["GET","POST","PUT","DELETE","HEAD","OPTIONS","PATCH"];const URL_REGEX=/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;function send(method,options){options=typeof options==="string"?{url:options}:options;const baseURL=defaultOptions.baseURL;if(baseURL&&!URL_REGEX.test(options.url||"")){options.url=baseURL?baseURL+options.url:options.url}if(options.body&&options.headers&&!options.headers["Content-Type"]){options.headers["Content-Type"]="application/x-www-form-urlencoded"}options={...defaultOptions,...options};const timeout=options.timeout;const events={...{onRequest:()=>{},onResponse:(resp)=>resp,onTimeout:()=>{},},...options.events,};events.onRequest(method,options);let worker;if(isQX){const qxOptions={...options};if(!qxOptions.opts){qxOptions.opts={}}Object.assign(qxOptions.opts,{hints:false});worker=$task.fetch({method,...qxOptions})}else if(isLoon||isSurge||isNode||isShadowrocket||isStash){worker=new Promise((resolve,reject)=>{const request=isNode?require("request"):$httpClient;request[method.toLowerCase()](options,(err,response,body)=>{if(err)reject(err);else resolve({statusCode:response.status||response.statusCode,headers:response.headers,body,})})})}else if(isScriptable){const request=new Request(options.url);request.method=method;request.headers=options.headers;request.body=options.body;worker=new Promise((resolve,reject)=>{request.loadString().then((body)=>{resolve({statusCode:request.response.statusCode,headers:request.response.headers,body,})}).catch((err)=>reject(err))})}else if(isBrowser){worker=new Promise((resolve,reject)=>{fetch(options.url,{method,headers:options.headers,body:options.body,}).then((response)=>response.json()).then((response)=>resolve({statusCode:response.status,headers:response.headers,body:response.data,})).catch(reject)})}let timeoutid;const timer=timeout?new Promise((_,reject)=>{timeoutid=setTimeout(()=>{events.onTimeout();return reject(`${method}URL:${options.url}exceeds the timeout ${timeout}ms`)},timeout)}):null;return(timer?Promise.race([timer,worker]).then((res)=>{clearTimeout(timeoutid);return res}):worker).then((resp)=>events.onResponse(resp))}const http={};methods.forEach((method)=>(http[method.toLowerCase()]=(options)=>send(method,options)));return http}
/* prettier-ignore */
function API(name="untitled",debug=false){const{isQX,isLoon,isSurge,isScriptable,isNode,isShadowrocket,isStash,}=ENV();return new(class{constructor(name,debug){this.name=name;this.debug=debug;this.http=HTTP();this.env=ENV();this.node=(()=>{if(isNode){const fs=require("fs");return{fs}}else{return null}})();this.initCache();const delay=(t,v)=>new Promise(function(resolve){setTimeout(resolve.bind(null,v),t)});Promise.prototype.delay=function(t){return this.then(function(v){return delay(t,v)})}}initCache(){if(isQX)this.cache=JSON.parse($prefs.valueForKey(this.name)||"{}");if(isLoon||isSurge)this.cache=JSON.parse($persistentStore.read(this.name)||"{}");if(isNode){let fpath="root.json";if(!this.node.fs.existsSync(fpath)){this.node.fs.writeFileSync(fpath,JSON.stringify({}),{flag:"wx"},(err)=>console.log(err))}this.root={};fpath=`${this.name}.json`;if(!this.node.fs.existsSync(fpath)){this.node.fs.writeFileSync(fpath,JSON.stringify({}),{flag:"wx"},(err)=>console.log(err));this.cache={}}else{this.cache=JSON.parse(this.node.fs.readFileSync(`${this.name}.json`))}}}persistCache(){const data=JSON.stringify(this.cache,null,2);if(isQX)$prefs.setValueForKey(data,this.name);if(isLoon||isSurge||isStash||isShadowrocket)$persistentStore.write(data,this.name);if(isNode){this.node.fs.writeFileSync(`${this.name}.json`,data,{flag:"w"},(err)=>console.log(err));this.node.fs.writeFileSync("root.json",JSON.stringify(this.root,null,2),{flag:"w"},(err)=>console.log(err))}}write(data,key){this.log(`SET ${key}`);if(key.indexOf("#")!==-1){key=key.substr(1);if(isLoon||isSurge||isStash||isShadowrocket){return $persistentStore.write(data,key)}if(isQX){return $prefs.setValueForKey(data,key)}if(isNode){this.root[key]=data}}else{this.cache[key]=data}this.persistCache()}read(key){if(key.indexOf("#")!==-1){key=key.substr(1);if(isLoon||isSurge||isStash||isShadowrocket){return $persistentStore.read(key)}if(isQX){return $prefs.valueForKey(key)}if(isNode){return this.root[key]}}else{return this.cache[key]}}delete(key){this.log(`DELETE ${key}`);if(key.indexOf("#")!==-1){key=key.substr(1);if(isLoon||isSurge||isStash||isShadowrocket){return $persistentStore.write(null,key)}if(isQX){return $prefs.removeValueForKey(key)}if(isNode){delete this.root[key]}}else{delete this.cache[key]}this.persistCache()}notify(title,subtitle="",content="",options={}){const openURL=options["open-url"];const mediaURL=options["media-url"];if(isQX)$notify(title,subtitle,content,options);if(isSurge){$notification.post(title,subtitle,content+`${mediaURL?"\n多媒体:"+mediaURL:""}`,{url:openURL})}if(isLoon||isStash||isShadowrocket){let opts={};if(openURL)opts["openUrl"]=openURL;if(mediaURL)opts["mediaUrl"]=mediaURL;if(JSON.stringify(opts)==="{}"){$notification.post(title,subtitle,content)}else{$notification.post(title,subtitle,content,opts)}}if(isNode||isScriptable){const content_=content+(openURL?`\n点击跳转:${openURL}`:"")+(mediaURL?`\n多媒体:${mediaURL}`:"");if(isJSBox){const push=require("push");push.schedule({title:title,body:(subtitle?subtitle+"\n":"")+content_,})}else{console.log(`${title}\n${subtitle}\n${content_}\n\n`)}}}log(msg){if(this.debug)console.log(`[${this.name}]LOG:${this.stringify(msg)}`)}info(msg){console.log(`[${this.name}]INFO:${this.stringify(msg)}`)}error(msg){console.log(`[${this.name}]ERROR:${this.stringify(msg)}`)}wait(millisec){return new Promise((resolve)=>setTimeout(resolve,millisec))}done(value={}){if(isQX||isLoon||isSurge||isStash||isShadowrocket){$done(value)}else if(isNode&&!isJSBox){if(typeof $context!=="undefined"){$context.headers=value.headers;$context.statusCode=value.statusCode;$context.body=value.body}}}stringify(obj_or_str){if(typeof obj_or_str==="string"||obj_or_str instanceof String)return obj_or_str;else try{return JSON.stringify(obj_or_str,null,2)}catch(err){return"[object Object]"}}})(name,debug)}