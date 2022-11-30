const util = require('util');

const default_hourly_wage = 16.00;
const default_minute_wage = default_hourly_wage / 60;

const default_cost_coeff = .5;

const default_boh_time = 1;
const default_foh_time = 1;


const fs = require('fs');
//const lo = require('lodash');
const catFilePath=process.argv[2];
const transFilePath=process.argv[3];
const csv=require('csvtojson');
const costs = {};
const prices = {};
csv()
.fromFile(catFilePath)
.then((catalog)=>{
  for(const item of catalog){
    if(!item.Cost){
      item.Cost = parseFloat(item.Price) * default_cost_coeff;
    }
    if(!item.BohPrepTime){
      item.BohPrepTime = default_boh_time;
    }
    if(!item.FohPrepTime){
      item.FohPrepTime = default_boh_time;
    }

    item.totalCost = parseFloat(item.Cost) 
    item.totalCost += (parseFloat(item.BohPrepTime) * default_minute_wage);
    item.totalCost += (parseFloat(item.FohPrepTime) * default_minute_wage);
    item.name = util.format('%s (%s)', item['Item Name'], item['Variation Name'])
    console.log('%s - Price: %d Cost: %d', item.name, item.Price, item.totalCost);
    costs[item.name] = item.totalCost;
    prices[item.name] = parseFloat(item.Price);
  }
  console.log('Catalog Loaded...');
  return csv().fromFile(transFilePath);
})
.then(async listing =>{
  let total = 0;
  let totalCost = 0;
  let date = undefined;
  for(const trans of listing){
    if(date !== trans["Date"]){
      if(date !== undefined){
        console.log("%s, %d", date, (total - totalCost).toFixed(2));
      }
      date = trans["Date"]
      total = 0;
      totalCost = 0;  
    }
    let gross = parseFloat(trans['Gross Sales']);
    total += gross;
    let fees = parseFloat(trans['Fees']);
    fees = Math.abs(fees)
    totalCost += fees
    let items = await csv({noheader:true,  output: "csv"}).fromString(trans['Description']);
    let partial = undefined;
    let stack = [];
    let multiple = 1;
    if(!items[0]){
      continue;
    }
    //console.log(gross);
    //console.log(trans['Description']);
    for(const item of items[0]){
      if(partial){
        // Unfortunately the square CSV format includes parens with commas if the user enters values like this
        partial = partial + ", " + item;
      }
      else{
        // Sometimes the sq system pads out some spaces???
        let itemName = item.replace(/  /g, ' '); 
        if(itemName.indexOf(' x ') > 0){
          [multiple, itemName] = itemName.split(' x ');
        }
        partial = itemName;
        multiple = parseInt(multiple);
      }

      if(costs[partial] || partial === "Custom Amount"){
        if(partial === "Custom Amount"){
          //console.log("Custom amount");
          partial = undefined;
          continue;
        }
      //  console.log("found %s: %d (%d), ... %i, %d", partial, costs[partial], prices[partial], multiple, gross );
        let itemCosts = (costs[partial] * multiple);
        totalCost += itemCosts;
        gross = gross - (prices[partial] * multiple);
        partial = undefined;
        multiple = 1;
      }
      else{
    //    console.log("NF " + partial)
      }

    }
    // End of that wacky for-loop parsing through the description of items
    // remaining gross would be "Custom Amounts" or other unknown cost junks, apply a default margin
    if(gross > 0){
    //  console.log("Remaining gross custom: %d", gross);
      totalCost += (gross * default_cost_coeff);
    }
  }
  //console.log("Total gross sales: " + total);
  //console.log("Total Costs: " + totalCost);
});


