let html = $response.body;



if (/"stock":0,/.test(html)) {
  html =
  html.replace(/name":"(.+?)",/g, `name":"$1@无库存",`);

}

html =
  html.replace(/"stock":0,/g, `"stock":77,`);

html =
  html.replace(/"status":"\d",/g, `"status":"1",`);

html =
  html.replace(/"beforeBuyTime":1,/g, ``);


html =
  html.replace(/"buy_start_time":"10:00:00"/g, `"buy_start_time":"00:00:00"`);




$done({ body: html});
