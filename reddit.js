var http = require('http');
var url = require('url');
var webRoot = "/r";

function endPage(res, x) {
  x = x || "";
  res.end(x + '</body></html>');
}

function renderListing(blob, res, url) {
  try {
    data = JSON.parse(blob);
    for(var i = 0; i < data.data.children.length; i++) {
      var story = data.data.children[i].data;
      var url;
      if(story.is_self) {
        url = webRoot + story.permalink.slice(2);
      } else {
        url = story.url;
      }
      res.write('<span><a href="' + url + '">' + story.title + '</a></span><br>' + 
          '[' + story.num_comments + ' <a href="' + webRoot + story.permalink.slice(2) + '">comments</a>] ' + story.subreddit + ' (' + story.domain + ')' +
          '<br><br>');
    }
    if (data.data.after) {
      res.write("<a href=\"" + webRoot + url + "?after=" + data.data.after + "\">Next page</a><br>");
    }
    endPage(res);
  } catch(e) {
    endPage(res, "Something bad happened, dude! What: " + e.message);
  }
}

function unescapeHtml(text) {
  try {
    text = text.replace(/&lt;/g, "<")
               .replace(/&gt;/g, ">")
               .replace(/&amp;#39;/g, "'")
               .replace(/&amp;quot;/g, "\"")
               .replace(/&amp;/g, "&")
               .replace(/<div[^>]*>/g, "")
               .replace(/<\/div>/g, "")
  } catch(e) {
  }
  return text;
}

function startIndent(res) {
  res.write('<blockquote>');
}

function endIndent(res) {
  res.write('</blockquote>');
}

function author(user) {
  return '<a href="http://reddit.com/user/' + user + '">' + user + '</a><br>';
}

function truncated(res) {
  res.write("<b>Thread truncated</b>");
}

function doComment(c, res) {
  res.write("<p>");
  res.write(author(c.author));
  res.write(unescapeHtml(c.body_html).replace("<p>", ""));
  if(typeof c.replies.data !== 'undefined') {
    startIndent(res);
    for(var i = 0; i < c.replies.data.children.length; i++) {
      if(c.replies.data.children[i].kind === "more") {
        truncated(res);
      } else {
        doComment(c.replies.data.children[i].data, res);
      }
    }
    endIndent(res);
  }
  res.write('</td></tr></table>');
}

function renderComments(blob, res, url) {
  try {
    data = JSON.parse(blob);
    var post = data[0].data.children[0].data;
    res.write('<span><a href="' + post.url + '">' + post.title + '</a></span><br>');
    res.write('Posted in <a href="../../../">' + post.subreddit + '</a> by ' + author(post.author) + '<br>');
    if(post.is_self && post.selftext_html != null) {
      res.write("<hr>");
      res.write(unescapeHtml(post.selftext_html));
      res.write("<hr>");
    }
    startIndent(res);
    for(var i = 0; i < data[1].data.children.length; i++) {
      if(data[1].data.children[i].kind === "more") {
        truncated(res);
      } else {
        doComment(data[1].data.children[i].data, res);
      }
      res.write('----');
    }
    endIndent(res);
    endPage(res);
  } catch(e) {
    endPage(res, "Something bad happened, dude! What: " + e.message);
  }
}

function style(res) {
  res.write("<link href='http://fonts.googleapis.com/css?family=PT+Sans+Narrow|PT+Serif' rel='stylesheet' type='text/css'>");
  res.write("<style>span { margin-bottom: 0; font-size: 250%; font-family: 'PT Sans Narrow', sans-serif; text-transform:uppercase; font-weight: bolder; } a:link { color: #369; text-decoration: none; } a:hover { text-decoration: underline; } a:visited { color: #737; } body { margin-left:10%; margin-right: 10%; background-color: #EBEBEB; font-family: 'PT Serif', serif; }</style>");
}

function send404(res) {
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.write('404 Not Found\n');
  res.end();
}

http.createServer(function (req, res) {
  var reddit_url = url.parse(req.url, true);
  if(reddit_url.path === '/favicon.ico') {
    send404();
    return;
  } else if(reddit_url.path === '/') {
    reddit_url = url.parse("/programming+truereddit+literature", true);
  }

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write("<html><head><meta http-equiv=\"Content-Type\" content=\"text/html;charset=utf-8\"/>"); 
  style(res);
  res.write("<title>Minimal Reddit</title></head><body>");

  var reddits = "/r" + reddit_url.pathname;
  var query_param = reddit_url.query;
  if(reddits[reddits.length - 1] === '/') reddits = reddits.slice(0, reddits.length - 1);
  reddits += ".json";
  if (query_param.after) {
    reddits += "?after=" + query_param.after;
  }
  console.log("Request for " + reddits);

  var render = reddits.indexOf("/comments/") == -1 ? renderListing : renderComments;
  var r = http.request({ host: 'www.reddit.com',
                         headers: {
                           'User-Agent': 'Minimal reddit mod v1.0 by j@cob.xxx'
                         },
                         path: reddits },
                         function(r) {
                           r.setEncoding();
                           var blob = "";
                           r.on('data', function(chunk) { blob += chunk; });
                           r.on('end', function() { render(blob, res, reddit_url.pathname); });
                         });

  r.on('error', function(e) {
    res.end('<b>Error</b> ' + e.message);
    endPage(res, '<b>Error</b> ' + e.message);
  });
  r.end();

}).listen(8001);
console.log("Running!");
