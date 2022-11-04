export const AMADEUS = {};

/**
 * The set of Ability Scores used within the sytem.
 * @type {Object}
 */

AMADEUS.ability = {
    warfare: "AMADEUS.ability.warfare",
    technique: "AMADEUS.ability.technique",
    brain: "AMADEUS.ability.brain",
    spirit: "AMADEUS.ability.spirit",
    love: "AMADEUS.ability.love",
    mundane: "AMADEUS.ability.mundane"
}

AMADEUS.ablAbb = {
    war: "AMADEUS.ability.warfare",
    tec: "AMADEUS.ability.technique",
    bra: "AMADEUS.ability.brain",
    spi: "AMADEUS.ability.spirit",
    lov: "AMADEUS.ability.love",
    mun: "AMADEUS.ability.mundane"
}
AMADEUS.label = {
    "name": "AMADEUS.label.name",
    "age": "AMADEUS.label.age",
    "job": "AMADEUS.label.job",
    "pantheon": "AMADEUS.label.pantheon",
    "parent": "AMADEUS.label.parent",
    "background" : "AMADEUS.label.background",
    "prophecy": "AMADEUS.label.prophecy",
    "relationship": "AMADEUS.label.relationship",
    "money": "AMADEUS.label.money",
    "color": "AMADEUS.label.color",
    "level": "AMADEUS.label.level",
    "exp": "AMADEUS.label.exp",
    "itemName": "AMADEUS.label.itemName"
}

AMADEUS.rank = {
    'S':4,
    'A':3,
    'B':2,
    'C':1,
    'D':0
}

AMADEUS.modL = {
    '+++':3,
    '++':2,
    '+':1,
    ' ':0,
    '-':-1,
    '--':-2
}

AMADEUS.dice = {
    "special": "AMADEUS.dice.special",
    "fumble" : "AMADEUS.dice.fumble",
    "shift": "AMADEUS.dice.shift",
    "1up": "AMADEUS.dice.1up",
    "2up": "AMADEUS.dice.2up",
    "1down": "AMADEUS.dice.1down",
    "drop": "AMADEUS.dice.drop"
}

AMADEUS.color = {
    'black': 'AMADEUS.color.black',
    'red': 'AMADEUS.color.red',
    'blue': 'AMADEUS.color.blue',
    'green': 'AMADEUS.color.green',
    'white': 'AMADEUS.color.white'
}

AMADEUS.background = {
    'genesis' : 'AMADEUS.background.genesis',
    'calamity': 'AMADEUS.background.calamity',
    'oracle': 'AMADEUS.background.oracle',
    'beast': 'AMADEUS.background.beast',
    'legend': 'AMADEUS.background.legend',
    'machine': 'AMADEUS.background.machine',
    'lost': 'AMADEUS.background.lost',
    'changeling': 'AMADEUS.background.changeling'
}
AMADEUS.item = {
    "equip": "AMADEUS.item.equip",
    "consume": "AMADEUS.item.consume"
}
AMADEUS.gift = {
    "spell": "AMADEUS.gift.spell",
    "passive": "AMADEUS.gift.passive",
    "support": "AMADEUS.gift.support"
}
AMADEUS.spAbility = {
    "melee": "AMADEUS.spAbility.melee",
    "random": "AMADEUS.spAbility.random",
    "intercept": "AMADEUS.spAbility.intercept",
    "parry": "AMADEUS.spAbility.parry",
    "critAtk": "AMADEUS.spAbility.critAtk",
    "accuracy": "AMADEUS.spAbility.accuracy",
    "stability": "AMADEUS.spAbility.stability",
    "armor": "AMADEUS.spAbility.armor",
    "antiFlight": "AMADEUS.spAbility.antiFlight",
    "antiDive": "AMADEUS.spAbility.antiDive",
    "spirAtk": "AMADEUS.spAbility.spirAtk",
    "glory": "AMADEUS.spAbility.glory",
    "effective": "AMADEUS.spAbility.effective",
    "relif": "AMADEUS.spAbility.relif"
}


/*
 AMADEUS.abilities = {
  "str": "AMADEUS.AbilityStr",
  "dex": "AMADEUS.AbilityDex",
  "con": "AMADEUS.AbilityCon",
  "int": "AMADEUS.AbilityInt",
  "wis": "AMADEUS.AbilityWis",
  "cha": "AMADEUS.AbilityCha"
};

AMADEUS.abilityAbbreviations = {
  "str": "AMADEUS.AbilityStrAbbr",
  "dex": "AMADEUS.AbilityDexAbbr",
  "con": "AMADEUS.AbilityConAbbr",
  "int": "AMADEUS.AbilityIntAbbr",
  "wis": "AMADEUS.AbilityWisAbbr",
  "cha": "AMADEUS.AbilityChaAbbr"
};
 */

export function getKeybyValue(obj, value) {
    return Object.keys(obj).find(key => obj[key] === value);
}