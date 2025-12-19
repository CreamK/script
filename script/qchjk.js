/*
 * @name: 雀巢会员Token 获取
 * @description: 从请求头中捕获雀巢会员小程序的 Authorization token，并去除 "Bearer " 前缀。
 * @author: Gemini
 * @version: 1.3.0
 *
 * 匹配URL: https://crm.nestlechinese.com/openapi/activityservice/api/
 * 变量名: NESTLE_TOKEN
 */

const scriptName = "雀巢会员Token";
const tokenKey = "NESTLE_TOKEN";
const bearerPrefix = 'Bearer ';


const authHeader = $request.headers['Authorization'];
const newToken = authHeader.substring(bearerPrefix.length).trim();
console.log(`[${scriptName}] 提取到的新Token: ${newToken}`);

// 读取已存储的 token
let storedTokens = $prefs.valueForKey(tokenKey);
if (storedTokens) {
    const tokenArray = storedTokens.split('&');
    if (!tokenArray.includes(newToken)) {
        // 如果新 token 不存在，则追加
        storedTokens += '&' + newToken;
        $prefs.setValueForKey(storedTokens, tokenKey);
        console.log(`[${scriptName}] Token已追加并保存。`);
        $notify(scriptName, "获取到新的Token", "新Token已成功追加 🎉");
    } else {
        // 如果 token 已存在，则不作处理，仅打印日志
        console.log(`[${scriptName}] 发现重复Token，无需更新。`);
    }
} else {
    console.log(`[${scriptName}] 未发现已存储的Token，首次存储。`);
    // 如果之前没有存储过 token，则直接存储
    $prefs.setValueForKey(newToken, tokenKey);
    console.log(`[${scriptName}] Token已成功保存。`);
    $notify(scriptName, "首次获取Token成功", "Token已保存 ✅");
}


$done({});

