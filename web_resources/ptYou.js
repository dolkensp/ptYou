
var ptYou = ptYou || {};
ptYou.localFriends = ptYou.localFriends || [];

ptYou.Initialize = function()
{
  var second = 1000;
  var minute = 60 * second;
  var hour = 60 * minute;
  var day = 24 * hour;
  
  ptYou.headers = {};
  ptYou.headers['X-' + window.RSI.Api.TOKEN_NAME] = $.cookie(window.RSI.Api.TOKEN_NAME);
  ptYou.handle = $('.handle').first().text();
  
  // chrome.storage.sync.clear();
  
  chrome.storage.sync.get(null, function(global) {
    global = global || {};
    global[ptYou.handle] = global[ptYou.handle] || {};
    global[ptYou.handle].friends = global[ptYou.handle].friends || [];
    global[ptYou.handle].lastHost = global[ptYou.handle].lastHost || '';
    global[ptYou.handle].lastSync = global[ptYou.handle].lastSync || 0;
    
    if ((window.location.hostname != global[ptYou.handle].lastHost) || // If we've swapped site
        (Date.now() - day > global[ptYou.handle].lastSync))            // Or it's been a while
    {
      ptYou.LoadFriends(1, null, global[ptYou.handle].friends);
    }
  });
}

ptYou.LoadFriends = function(page, localFriends, globalFriends)
{
  page = page || 1;
  localFriends = localFriends || [];
  
  $.ajax({
    url: '/api/contacts/list',
    method: 'POST',
    data: { page: page++, query: "" }, 
    headers: ptYou.headers,
    success: function(result) {
      if (result.success)
      {
        localFriends.push.apply(localFriends, result.data.resultset.map(function(friend) { return friend.nickname }));
        
        if (page <= result.data.pagecount) ptYou.LoadFriends(page, localFriends, globalFriends);
        else ptYou.FriendSync(localFriends, globalFriends);
        
      } else {
        console.log("error", result);
      }
    }
  });
}

ptYou.FriendDiff = function(localFriends, globalFriends)
{
  var lookup = {};
  var missingFriends = [];
  
  localFriends = localFriends || [];
  globalFriends = globalFriends || [];
  
  for (var i = 0, j = localFriends.length; i < j; i++)
  {
    var friend = localFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
    }
  }
  
  for (var i = 0, j = globalFriends.length; i < j; i++)
  {
    var friend = globalFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
      missingFriends.push(friend);
    }
  }
  
  return missingFriends;
}

ptYou.FriendMerge = function(localFriends, globalFriends)
{
  var lookup = {};
  var allFriends = [];
  
  localFriends = localFriends || [];
  globalFriends = globalFriends || [];
  
  var allFriends = [];
  
  for (var i = 0, j = localFriends.length; i < j; i++)
  {
    var friend = localFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
      allFriends.push(friend);
    }
  }
  
  for (var i = 0, j = globalFriends.length; i < j; i++)
  {
    var friend = globalFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
      allFriends.push(friend);
    }
  }
  
  return allFriends;
}

ptYou.FriendSync = function(localFriends, globalFriends)
{
  var newFriends = ptYou.FriendDiff(localFriends, globalFriends);
  var oldFriends = ptYou.FriendDiff(globalFriends, localFriends);
  var allFriends = ptYou.FriendMerge(localFriends, globalFriends);
  
  var data = {};
  
  data[ptYou.handle] = {
    friends: allFriends,
    lastSync: Date.now(),
    lastHost: window.location.hostname,
  };
  
  ptYou.FriendAdd(newFriends, data)
}

ptYou.FriendAdd = function(newFriends, data)
{
  if (newFriends.length == 0)
  {
    chrome.storage.sync.set(data);
  }
  else
  {
    var friend = newFriends.pop();
    $.ajax({
      url: '/api/contacts/add',
      method: 'POST',
      headers: ptYou.headers,
      data: { nickname: friend },
      success: function(result) { 
        if (result.success) console.log('Added ' + friend);
        else console.log('Skipped ' + friend, result.msg);
        
        ptYou.FriendAdd(newFriends, data);
      },
    });
  }
}

ptYou.Initialize();
