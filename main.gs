// Original Doc. that reverse engineered: https://docs.google.com/spreadsheets/d/16ewJkewq-kxabSjRETMXzSy7TAXhPMhj87gSKTgjYwo/edit?gid=95682265#gid=95682265

// Idea of the script by: dud https://app.warera.io/user/687fda07d95a8301887aabdd

function triggerAction()
{
  const TR_ID = "6813b6d446e731854c7ac7eb";
  const AZE_ID = "6813b6d546e731854c7ac8d1";

  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (const sheet of sheets)
  {
    var sheetId = sheet.getIndex();
    if(sheetId == 1)
      fillSheetById([TR_ID], sheet);
    else if(sheetId == 2)
      fillSheetById([AZE_ID], sheet);
    else
      fillSheetById([TR_ID, AZE_ID], sheet);
  }
}

function fillSheetById(countryIds, sheet)
{
   const options = {
    countryId: "0",
    limit : 100
  };

  var data = {elements:[], items:[]};
  var i = 0
  for(var id of countryIds)
  {
    options.countryId = id;

    var response = UrlFetchApp.fetch(buildUrl("https://api2.warera.io/trpc/user.getUsersByCountry", options));
    var responseNewData = JSON.parse(response.getContentText());
    newData = responseNewData.result.data.items;
    data.elements.push(newData);

    while (responseNewData.result.data.nextCursor !== undefined) {
      var input = {
        0: {
          countryId: id,
          cursor: responseNewData.result.data.nextCursor,
          direction: "forward"
        }
      };
      var ext_url = `https://api2.warera.io/trpc/user.getUsersByCountry?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`
      var ext_response = UrlFetchApp.fetch(ext_url);
      var ext_responseNewData = JSON.parse(ext_response.getContentText())[0];
      data.elements[i] = data.elements[i].concat(ext_responseNewData.result.data.items);

      responseNewData = ext_responseNewData;
    }

    for(var j = 0; j < data.elements[i].length; j++)
    {
      data.items.push(data.elements[i][j]);
    }
    i++;
  }
  
  data = data.items;

  const MAXLEVEL = 23;

  var playerLevelCount = Array.apply(null, Array(MAXLEVEL)).map(function(_, i) {return 0});
  var playerLevelTotalWealth = Array.apply(null, Array(MAXLEVEL)).map(function(_, i) {return 0});
  
  sheet.getRange(3,2,100,4).clearContent();

  var minLvl = MAXLEVEL;
  var maxLvl = 0;
  for (i = 0; i < data.length; i++)
  {
    // avoid 429 response (Too Many Requests) and reduces the load on the server.
    Utilities.sleep(500); 
    const options = {
      userId: data[i]._id.toString(),
    };
    var response = UrlFetchApp.fetch(buildUrl("https://api2.warera.io/trpc/user.getUserLite", options));
    var dataUsers = JSON.parse(response.getContentText());
    dataUsers = dataUsers.result.data

    try{dataUsers.rankings.userWealth;}
    catch(e){continue;}
    
    sheet.getRange(i+3,1).setFormula('=HYPERLINK("https://app.warera.io/user/' + options.userId + '","' + dataUsers.username + '")');

    sheet.getRange(i+3,2).setValue(dataUsers.leveling.level);
    sheet.getRange(i+3,3).setValue(dataUsers.rankings.userWealth.value);
    sheet.getRange(i+3,4).setValue(dataUsers.rankings.userWealth.rank);

    if(dataUsers.mu)
    {
        const options = {
        muId: dataUsers.mu,
      };
      var response = UrlFetchApp.fetch(buildUrl("https://api2.warera.io/trpc/mu.getById", options));
      var dataMu = JSON.parse(response.getContentText());
      dataMu = dataMu.result.data

      sheet.getRange(i+3,5).setFormula('=HYPERLINK("https://app.warera.io/mu/' + dataUsers.mu + '","' + dataMu.name + '")');
    }
    

    playerLevelCount[dataUsers.leveling.level - 1] += 1;
    playerLevelTotalWealth[dataUsers.leveling.level - 1] += dataUsers.rankings.userWealth.value;

    if(dataUsers.leveling.level < minLvl)
      minLvl = dataUsers.leveling.level;
    else if(dataUsers.leveling.level > maxLvl)
      maxLvl = dataUsers.leveling.level;
  }

  var averageLvl = 0
  for (i = 0; i < MAXLEVEL; i++)
  {
    sheet.getRange(4+i,9).setValue(i + 1);
    sheet.getRange(4+i,10).setValue(playerLevelCount[i]);
    if(playerLevelCount[i] == 0)
      sheet.getRange(4+i,11).setValue("-");
    else
      sheet.getRange(4+i,11).setValue(playerLevelTotalWealth[i] / playerLevelCount[i]);

    averageLvl += playerLevelCount[i] * (i + 1);
  }

  var playerCount = data.length + 1
  sheet.getRange(5,7).setValue("Players: " + playerCount);

  averageLvl = averageLvl / playerCount
  sheet.getRange(6,7).setValue("Average: " + Utilities.formatString('%.02f', averageLvl));

  var i = 0;
  var middleIndex = Math.ceil(playerCount * 0.5);
  while (middleIndex >= 0)
  {
    middleIndex -= playerLevelCount[i];
    i++
  }

  i++ // index starts from 0
  sheet.getRange(7, 7).setValue(`="Median: " & MEDIAN(B3:B)`);

  sheet.getRange(8,7).setValue("Min: " + minLvl);
  sheet.getRange(9,7).setValue("Max: " + maxLvl);

  const JUMP = 3;
  for (i = 0; i < MAXLEVEL; i = i + JUMP)
  {
    var startIndex = i+1;
    var endIndex = i+JUMP;
    var value = 0;
    for(var j = i; j < JUMP + i; j++)
    {
      value += playerLevelCount[j];
    }

    sheet.getRange(12+(i/JUMP), 7).setValue(startIndex + "-" + endIndex + ": " + value);
  }

  var currentDate = new Date();
  currentDate = Utilities.formatDate(currentDate, "GMT+2", "HH:mm dd-MM-yy");
  sheet.getRange(1,1).setValue("Data updated: " + currentDate);
}


/**
 * Builds a complete URL from a base URL and a map of URL parameters.
 * @param {string} url The base URL.
 * @param {Object.<string, string>} params The URL parameters and values.
 * @return {string} The complete URL.
 * @private
 */
function buildUrl(url, params) {
  var paramString = Object.keys(params).map(function(key) {
    var addStr = (typeof params[key] == 'string' ? "%22" : "");
    return "%22" + key + "%22:" + addStr + params[key] + addStr;
  }).join(',');
  return url + (url.indexOf('?') >= 0 ? '!!!' : '?') + "input=%7B" + paramString + "%7D";

}



