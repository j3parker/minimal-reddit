var http = require('http');
var url = require('url');

function endPage(res, x) {
  x = x || "";
  res.end(x + '</body></html>');
}

function renderListing(blob, res) {
  try {
    data = JSON.parse(blob);
    for(var i = 0; i < data.data.children.length; i++) {
      var story = data.data.children[i];
      res.write('<a href="' + story.data.url + '">' + story.data.title + '</a> (' + story.data.domain + ') <br>' + 
          '[' + story.data.num_comments + ' <a href="' + story.data.permalink.slice(2) + '">comments</a>] ' + story.data.subreddit +
          '<br><br>');
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

function renderComments(blob, res) {
  try {
    data = JSON.parse(blob);
    var post = data[0].data.children[0].data;
    res.write('<a href="' + post.url + '">' + post.title + '</a><br>');
    res.write('Posted in <a href="../../../">' + post.subreddit + '</a> by ' + author(post.author) + '<br>');
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

http.createServer(function (req, res) {
  if(url.parse(req.url).href === '/favicon.ico') {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('404 Not Found\n');
    res.end();
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write("<html><head><meta http-equiv=\"Content-Type\" content=\"text/html;charset=utf-8\"/><title>Minimal Reddit</title></head><body>");
  var reddits = "/r" + url.parse(req.url).href;
  if(reddits[reddits.length - 1] === '/') reddits = reddits.slice(0, reddits.length - 1);
  reddits += ".json";
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
                           r.on('end', function() { render(blob, res); });
                         });

  r.on('error', function(e) {
    res.end('<b>Error</b> ' + e.message);
    endPage(res, '<b>Error</b> ' + e.message);
  });
  r.end();

}).listen(8001);
console.log("Running!");
