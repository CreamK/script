
/**

 */

let html = $response.body;


html =
  html.replace(/planStartDt":"\d+"/g, `planStartDt":"20230414"`);



if (html.includes('</head>')) {
  html = '<script src="https://unpkg.com/vconsole@3.14.6/dist/vconsole.min.js" ignore></script><script ignore>new VConsole()</script>' + html;
}


$done({ body: html});

$done({ body:`
`});
