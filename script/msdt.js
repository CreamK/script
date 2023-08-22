// 民生答题
let html = $response.body;

 html =
  html.replace(/("otitle": "[\s\S]+?)(",[\s\S]+?"oanswer": ")(.+?)(",)/gi, '$1@$3$2$3$4');

$done({ body: html });
// https://api.myminapp.com/hserve url response-body "correct":\s?true,\s?"name":\s?" response-body "correct": true, "name": "7@
