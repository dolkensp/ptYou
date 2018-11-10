
var ptYou = ptYou || {};
ptYou.localContacts = ptYou.localContacts || [];

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
  
  chrome.storage.local.get(null, function(global) {
    global = global || {};
    global[ptYou.handle] = global[ptYou.handle] || {};
    global[ptYou.handle].contacts = global[ptYou.handle].contacts || [];
    global[ptYou.handle].friends  = global[ptYou.handle].friends  || [];
    global[ptYou.handle].lastHost = global[ptYou.handle].lastHost || '';
    global[ptYou.handle].lastSync = global[ptYou.handle].lastSync || 0;
    
    console.log('State.Load', global[ptYou.handle]);
    
    var local = {};
    local.contacts = [];
    local.friends  = [];
    local.lastHost = window.location.hostname;
    local.lastSync = Date.now();
    
    ptYou.data = global;
    
    ptYou.global = global[ptYou.handle];
    ptYou.local = local || {};
    
    if ((ptYou.local.lastHost != ptYou.global.lastHost) ||      // If we've swapped site
        (ptYou.local.lastSync - day > ptYou.global.lastSync) || // Or it's been a while
        force)                                                  // Or we're forcing a sync
    {
      ptYou.LoadFriends();
    }
  });
}

ptYou.LoadFriends = function()
{
  console.log('Friends.Load', { localFriends: ptYou.local.friends.length, globalFriends: ptYou.global.friends.length });
  
  $.ajax({
    url: '/api/spectrum/auth/identify',
    method: 'POST',
    data: { }, 
    headers: ptYou.headers,
    success: function(result) {
      if (result.success)
      {
        // Add existing friends to list
        ptYou.local.friends.push.apply(ptYou.local.friends, result.data.friends.map(function(friend) { return friend.nickname }));
        
        // Scan for inbound requests
        ptYou.requests = result.data.friend_requests;
        
        ptYou.member_id = result.data.member.id;
        
        console.log('Friends.Loaded', { localFriends: ptYou.local.friends.length, globalFriends: ptYou.global.friends.length, requests: ptYou.requests.length });
        
        // TODO: Once contacts are offline, comment LoadContacts(), and uncomment FriendSync()
        ptYou.LoadContacts();
        // ptYou.FriendSync();
      } else {
        console.log("error", result);
      }
    }
  });
}

ptYou.LoadContacts = function(page)
{
  page = page || 1;
  
  console.log('Contacts.Load', { page: page, localContacts: ptYou.local.contacts.length, globalContacts: ptYou.global.contacts.length });
  
  $.ajax({
    url: '/api/contacts/list',
    method: 'POST',
    data: { page: page++, query: "" }, 
    headers: ptYou.headers,
    success: function(result) {
      if (result.success)
      {
        ptYou.local.contacts.push.apply(ptYou.local.contacts, result.data.resultset.map(function(friend) { return friend.nickname }));
        
        if (page <= result.data.pagecount) ptYou.LoadContacts(page);
        else {
          console.log('Contacts.Loaded', { localContacts: ptYou.local.contacts.length, globalContacts: ptYou.global.contacts.length });
          ptYou.FriendSync();
        }
        
      } else {
        console.log("error", result);
      }
    }
  });
}

ptYou.Union = function(left, right)
{
  var lookup = {};
  var result = [];
  var i, j, item;
  
  for (i = 0, j = left.length; i < j; i++)
  {
    item = left[i];
    if (lookup[item] != true)
    {
      lookup[item] = true;
      result.push(item);
    }
  }
  
  for (i = 0, j = right.length; i < j; i++)
  {
    item = right[i];
    if (lookup[item] != true)
    {
      lookup[item] = true;
      result.push(item);
    }
  }
  
  return result;
}

ptYou.Intersect = function(left, right)
{
  var lookup = {};
  var result = [];
  var i, j;
  
  for (i = 0, j = left.length; i < j; i++) lookup[left[i]] = true;
  
  for (i = 0, j = right.length; i < j; i++)
  {
    if (lookup[right[i]] == true) result.push(right[i]);
  }
  
  return result;
}

ptYou.Except = function(left, right)
{
  var lookup = {};
  var result = [];
  var i, j;
  
  for (i = 0, j = right.length; i < j; i++) lookup[right[i]] = true;
  
  for (i = 0, j = left.length; i < j; i++)
  {
    if (lookup[left[i]] != true) result.push(left[i]);
  }
  
  return result;
}

ptYou.FriendSync = function()
{
  var localFriends = ptYou.Union(ptYou.local.friends, ptYou.local.contacts);
  var globalFriends = ptYou.Union(ptYou.global.friends, ptYou.global.contacts);
  var allFriends = ptYou.Union(localFriends, globalFriends);
  
  ptYou.newFriends = ptYou.Except(allFriends, ptYou.local.friends);
  ptYou.newContacts = ptYou.Except(allFriends, ptYou.local.contacts);
  
  var inboundRequests = ptYou.requests.filter(function(request) { return request != null && request.requesting_member_id != ptYou.member_id; }).map(function(request) { return request.members[0].nickname; })
  var outboundRequests = ptYou.requests.filter(function(request) { return request != null && request.requesting_member_id == ptYou.member_id; }).map(function(request) { return request.members[0].nickname; })
  
  ptYou.newInvites = ptYou.Intersect(allFriends, inboundRequests);
  
  ptYou.newFriends = ptYou.Except(ptYou.newFriends, outboundRequests);
  ptYou.newFriends = ptYou.Except(ptYou.newFriends, inboundRequests);
  
  console.log('Friends.Sync', { newFriends: ptYou.newFriends.length, newContacts: ptYou.newContacts.length, newInvites: ptYou.newInvites.length });
  
  ptYou.FriendAccept();
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
      var i;
      
      if (result.success && result.data.hits.total > 0) {
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

ptYou.FriendAdd = function()
{
  if (ptYou.newFriends.length == 0)
  {
    ptYou.ContactAdd();
  }
  else
  {
    var friend = ptYou.newFriends.pop();
    
    ptYou.FriendFind(friend, function(member) {
      if (member == undefined) {
        console.log('Friends.Add', 'Failed to locate ' + friend);
        
        ptYou.FriendAdd();
      } else {
        console.log('Friends.Add', 'Located ' + friend);
        
        $.ajax({
          url: '/api/spectrum/friend-request/create',
          method: 'POST',
          headers: ptYou.headers,
          contentType: "text/plain",
          data: JSON.stringify({ member_id: member.id }),
          success: function(result) {
            if (result.success) console.log('Friends.Add', 'Added ' + friend);
            else console.log('Friends.Add', 'Skipped ' + friend, result.msg);
            
            ptYou.FriendAdd();
          }
        });
      }
    });
  }
}

ptYou.ContactAdd = function()
{
  if (ptYou.newContacts.length == 0)
  {
    ptYou.SaveState();
  }
  else
  {
    var friend = ptYou.newContacts.pop();
    
    $.ajax({
      url: '/api/contacts/add',
      method: 'POST',
      headers: ptYou.headers,
      data: { nickname: friend },
      success: function(result) { 
        if (result.success) console.log('Contacts.Add', 'Added ' + friend);
        else console.log('Contacts.Add', 'Skipped ' + friend, result.msg);
        
        ptYou.ContactAdd();
      },
    });
  }
}

ptYou.FriendAccept = function()
{
  if (ptYou.newInvites.length == 0)
  {
    ptYou.FriendAdd();
  }
  else
  {
    var friend = ptYou.newInvites.pop();
    
    var request = ptYou.requests.filter(function(member) { return member.members[0].nickname == friend })[0];
    
    if (request == undefined) {
      console.log('Friends.Accept', 'Failed to locate ' + friend);
      
      ptYou.FriendAccept();
    } else {
      console.log('Friends.Accept', 'Located ' + friend);
      
      $.ajax({
        url: '/api/spectrum/friend-request/accept',
        method: 'POST',
        headers: ptYou.headers,
        contentType: "text/plain",
        data: JSON.stringify({ request_id: request.id }),
        success: function(result) {
          if (result.success) console.log('Friends.Accept', 'Added ' + friend);
          else console.log('Friends.Accept', 'Skipped ' + friend, result.msg);
          
          ptYou.FriendAccept();
        }
      });
    }
  }
}

ptYou.SaveState = function()
{
  ptYou.merge = {};
  ptYou.merge.friends = ptYou.Union(ptYou.local.friends, ptYou.global.friends);
  ptYou.merge.contacts = ptYou.Union(ptYou.local.contacts, ptYou.global.contacts);
  ptYou.merge.lastHost = ptYou.local.lastHost;
  ptYou.merge.lastSync = ptYou.local.lastSync;
  
  console.log('State.Save', ptYou.merge);
  
  ptYou.data[ptYou.handle] = ptYou.merge;

  chrome.storage.local.set(ptYou.data);
}

// chrome.storage.local.clear();
// var force = true;

ptYou.Initialize();
