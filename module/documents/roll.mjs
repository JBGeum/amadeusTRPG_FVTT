export async function amadeRoll(rank, rankVal, rollData){
    let roll;
    if(rank === 'D')
        roll = new Roll("2d6", rollData);
    else
        roll = new Roll(rankVal + "d6",rollData);
    //https://foundryvtt.com/api/classes/client.Roll.html#dice
    await roll.evaluate({async: true});
    return roll;
}