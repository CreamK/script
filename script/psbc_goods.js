/**

 */
let html = $response?.body;

const timeArr = html.match(/"startTime":\d+/g);

for (let i = 0; i < timeArr.length; i++) {
  const timeStr = timeArr[i];
  const time =
    parseInt(timeStr.replace(/"startTime":(\d+)/, '$1')) - 60 * 60 * 1000;
  html = html.replace(timeStr, `"startTime":${time}`);
}

// console.log(timeArr);

$done({ body: html });

