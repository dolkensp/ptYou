
var ptYou = ptYou || {};
ptYou.localFriends = ptYou.localFriends || [];

ptYou.Initialize = function(force)
{
  force = force || false;
  var second = 1000;
  var minute = 60 * second;
  var hour = 60 * minute;
  var day = 24 * hour;
  
  if (window.jQuery == undefined) return;
  if (window.RSI == undefined) return;
  if (window.RSI.Api == undefined) return;
  if (window.RSI.Api.TOKEN_NAME == undefined) return;
  
  ptYou.handle = $('.c-account-sidebar__profile-info-handle').first().text();
  
  ptYou.headers = {};
  ptYou.headers['X-' + window.RSI.Api.TOKEN_NAME] = $.cookie(window.RSI.Api.TOKEN_NAME);
  ptYou.headers['X-Tavern-Id'] = 'ptYou-' + btoa(ptYou.handle);
  
  if (ptYou.handle == "") return;
  
  // chrome.storage.local.clear();
  
  chrome.storage.local.get(null, function(global) {
    global = global || {};
    global[ptYou.handle] = global[ptYou.handle] || {};
    global[ptYou.handle].friends = global[ptYou.handle].friends || [];
    global[ptYou.handle].lastHost = global[ptYou.handle].lastHost || '';
    global[ptYou.handle].lastSync = global[ptYou.handle].lastSync || 0;
    
    if ((window.location.hostname != global[ptYou.handle].lastHost) || // If we've swapped site
        (Date.now() - day > global[ptYou.handle].lastSync) ||          // Or it's been a while
        force)                                                         // Or we're forcing a sync
    {
      ptYou.LoadFriends(1, null, global[ptYou.handle].friends);
    }
  });
}

ptYou.LoadFriends = function(page, localFriends, globalFriends)
{
  console.log('LoadFriends', page, localFriends, globalFriends);
  
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
  
  var i, j, friend;
  
  localFriends = localFriends || [];
  globalFriends = globalFriends || [];
  
  for (i = 0, j = localFriends.length; i < j; i++)
  {
    friend = localFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
    }
  }
  
  for (i = 0, j = globalFriends.length; i < j; i++)
  {
    friend = globalFriends[i];
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
  
  var i, j, friend;
  
  localFriends = localFriends || [];
  globalFriends = globalFriends || [];
  
  for (i = 0, j = localFriends.length; i < j; i++)
  {
    friend = localFriends[i];
    if (lookup[friend] != true)
    {
      lookup[friend] = true;
      allFriends.push(friend);
    }
  }
  
  for (i = 0, j = globalFriends.length; i < j; i++)
  {
    friend = globalFriends[i];
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
  console.log('FriendSync', localFriends, globalFriends);
  localFriends = [];
  
  var newFriends = ptYou.FriendDiff(localFriends, globalFriends);
  // var oldFriends = ptYou.FriendDiff(globalFriends, localFriends);
  var allFriends = ptYou.FriendMerge(localFriends, globalFriends);
  
  var data = {};
  
  data[ptYou.handle] = {
    friends: allFriends,
    lastSync: Date.now(),
    lastHost: window.location.hostname,
  };
  
  ptYou.FriendAdd(newFriends, data)
}

ptYou.FriendFind = function(friend, callback)
{
  $.ajax({
    url: '/api/spectrum/search/member/autocomplete',
    method: 'POST',
    headers: ptYou.headers,
    contentType: "text/plain",
    data: JSON.stringify({ community_id: null, text: friend, ignore_self: true }),
    success: function(result) {
      if (result.success) {
        for (i = 0; i < result.data.members.length; i++) {
          if (result.data.members[i].nickname == friend) {
            callback(result.data.members[i]);
            return;
          }
        }
      }
      
      callback();
    },
  });
}

ptYou.FriendAdd = function(newFriends, data)
{
  if (newFriends.length == 0)
  {
    chrome.storage.local.set(data);
  }
  else
  {
    var friend = newFriends.pop();
    
    ptYou.FriendFind(friend, function(member) {
      if (member == undefined) {
        console.log('Failed to locate ' + friend);
        
        ptYou.FriendAdd(newFriends, data);
      } else {
        console.log('Located ' + friend);
        
        $.ajax({
          url: '/api/spectrum/friend-request/create',
          method: 'POST',
          headers: ptYou.headers,
          contentType: "text/plain",
          data: JSON.stringify({ member_id: member.id }),
          success: function(result) {
            if (result.success) console.log('Added ' + friend);
            else console.log('Skipped ' + friend, result.msg);
            
            ptYou.FriendAdd(newFriends, data);
          }
        });
      }
    });
    
    /*
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
    */
  }
}

ptYou.Initialize();