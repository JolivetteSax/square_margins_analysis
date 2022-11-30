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
// sortable list of percent and real dollar profits from the catalog
const margins = [];
//tally of the earned profits from transactions on the margins
const profit = {};
const counts = {};
const visits = {};
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
    const price = parseFloat(item.Price);
    prices[item.name] = price;
    let name = item.name;
    let profit = price - item.totalCost;
    if (profit < 0){
      continue;
    }
    let percent = profit / price;
    margins.push({name, profit, percent});
    profit[name] = 0;
  }

  console.log('Catalog Loaded...');

  return csv().fromFile(transFilePath);
})
.then(async listing =>{
  for(const trans of listing){
    let customer = trans['Customer Name'];
    if(!customer){
      continue;
    }
    if(!visits[customer]){
      visits[customer] = 1;
    }
    else{
      visits[customer] += 1;
    }
    let items = await csv({noheader:true,  output: "csv"}).fromString(trans['Description']);
    let partial = undefined;
    let multiple = 1;
    if(!items[0]){
      continue;
    }
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
        let itemCost = costs[partial];
        let itemPrice = prices[partial];
        let itemProfit = (itemPrice - itemCost) * multiple;
        if(!profit[customer]){
          profit[customer] = itemProfit;
          counts[customer] = multiple;
        }
        else{
          profit[customer] += itemProfit;
          counts[customer] += multiple;
        }
        // reset
        partial = undefined;
        multiple = 1;
      }
      else{
    //    console.log("NF " + partial)
      }

    }
  }
  //console.log("Total gross sales: " + total);
  //console.log("Total Costs: " + totalCost);
}).then(() => {
   const customers = [];
   for(const name in profit){
     let net = profit[name];
     let count = counts[name];
     let visitCount = visits[name];
     let perVisit = net / visitCount;
     customers.push({name, net, count, visitCount, perVisit});
   }
   return customers;
})
.then((customers) => {
  customers.sort((a,b) => (a.net < b.net) ? 1 : ((b.net < a.net) ? -1 : 0));
  for(const customer of customers){
     console.log('%s, %d, %i, %i, %d', customer.name, customer.net.toFixed(2), customer.count, customer.visitCount, customer.perVisit.toFixed(2));
  }
});


