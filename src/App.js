import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Constantes del Juego ---
const ITEM_RARITIES = {
    common: { name: 'Común', color: 'text-gray-300', multiplier: 1 },
    rare: { name: 'Raro', color: 'text-blue-400', multiplier: 1.5 },
    epic: { name: 'Épico', color: 'text-purple-500', multiplier: 2.5 },
};

const ITEM_TEMPLATES = {
    weapon: { name: 'Espada', icon: '⚔️', stat: 'damage', baseValue: 2 },
    shield: { name: 'Escudo', icon: '🛡️', stat: 'maxHp', baseValue: 10 },
    amulet: { name: 'Amuleto', icon: '💎', stat: 'critChance', baseValue: 0.01 },
};

// --- Estado Inicial del Juego ---
const initialHeroState = {
    level: 1,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0.05,
    critMultiplier: 1.5, // CORREGIDO: Faltaba esta propiedad
    gold: 0,
    xp: 0,
    xpNeeded: 100,
    equipment: {
        weapon: null,
        shield: null,
        amulet: null,
    },
};

const initialGameState = {
    hero: { ...initialHeroState },
    inventory: [],
    monster: {
        name: "Orco Débil",
        hp: 50,
        maxHp: 50,
        goldReward: 5,
        xpReward: 10,
        art: '👹',
    },
    upgrades: {
        damage: { cost: 10, increase: 1, level: 0 },
        health: { cost: 15, increase: 10, level: 0 },
        critChance: { cost: 50, increase: 0.01, level: 0 },
    },
    skills: {
        powerfulStrike: { name: 'Golpe Poderoso', cooldown: 10, remaining: 0, description: 'Inflige 300% de daño.' },
        quickHeal: { name: 'Curación Rápida', cooldown: 30, remaining: 0, description: 'Cura 25% de la vida máxima.' },
        goldRush: { name: 'Lluvia de Oro', cooldown: 60, remaining: 0, description: 'Duplica el oro del próximo monstruo.' },
    },
    effects: {
        powerfulStrikeActive: false,
        goldRushActive: false,
    },
    stage: 1,
    monstersKilledInStage: 0,
    monstersPerStage: 10,
    monsterArt: ['👹', '👺', '👻', '👽', '💀', '🤖', '🎃', '🐲', '🦂', '🦇'],
    bossArt: ['😈', '🤡', '👹', '🧛', '🧟', '🧞', '🦍', '🐊', '🦖', '🐙'],
    combatLog: [],
    floatingTexts: [],
    isBossFight: false,
    bossTimer: 30,
    prestige: {
        level: 0,
        relics: 0,
        nextLevelReq: 50,
    },
    prestigeUpgrades: {
        goldBonus: { name: 'Bendición Dorada', level: 0, cost: 1, increase: 0.1, description: '+10% Oro por nivel' },
        damageBonus: { name: 'Fuerza Ancestral', level: 0, cost: 1, increase: 0.05, description: '+5% Daño por nivel' },
    }
};

// --- Componentes de la UI ---

const HeroPanel = ({ hero, stats, prestige }) => {
    const xpPercentage = (hero.xp / hero.xpNeeded) * 100;
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Héroe</h2>
            {prestige.level > 0 && <p className="text-center text-yellow-400 font-bold">Prestigio: {prestige.level}</p>}
            <div className="space-y-3 text-lg mt-2">
                <p><strong>Nivel:</strong> {hero.level}</p>
                <p><strong>HP:</strong> {Math.round(hero.hp)} / {stats.maxHp}</p>
                <p><strong>Daño:</strong> {stats.damage.toFixed(1)}</p>
                <p><strong>Prob. Crítico:</strong> {(stats.critChance * 100).toFixed(2)}%</p>
                <p><strong>Oro:</strong> {hero.gold}</p>
                <div>
                    <strong>XP:</strong>
                    <div className="w-full bg-gray-700 rounded-full h-4 mt-1">
                        <div className="bg-blue-500 h-4 rounded-full transition-all duration-300" style={{ width: `${xpPercentage}%` }}></div>
                    </div>
                    <p className="text-sm text-center mt-1">{hero.xp} / {hero.xpNeeded}</p>
                </div>
            </div>
        </div>
    );
};

const CombatPanel = ({ monster, stage, combatLog, isBossFight, bossTimer }) => {
    const hpPercentage = (monster.hp / monster.maxHp) * 100;
    const logRef = useRef(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [combatLog]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-between h-full">
            <div>
                <h2 className={`text-2xl font-bold text-center ${isBossFight ? 'text-yellow-400 animate-pulse' : 'text-red-400'}`}>{monster.name}</h2>
                <div id="monster-art-container" className={`text-6xl text-center my-4 relative ${isBossFight ? 'transform scale-125' : ''}`}>{monster.art}</div>
                <div className="relative">
                    <div className="w-full bg-gray-700 rounded-full h-6">
                        <div className={`${isBossFight ? 'bg-yellow-500' : 'bg-red-600'} h-6 rounded-full transition-all duration-300`} style={{ width: `${hpPercentage}%` }}></div>
                    </div>
                    <p className="absolute inset-0 flex items-center justify-center font-bold">
                        {Math.round(monster.hp)} / {monster.maxHp}
                    </p>
                </div>
                {isBossFight ? (
                    <p className="text-center mt-2 text-2xl font-bold text-red-500">Tiempo: {bossTimer}</p>
                ) : (
                    <p className="text-center mt-2"><strong>Etapa:</strong> {stage}</p>
                )}
            </div>
            <div ref={logRef} className="w-full h-48 bg-gray-900 rounded-lg mt-4 p-2 overflow-y-auto text-sm">
                {combatLog.map((msg, index) => (
                    <p key={index} className={msg.color}>{msg.text}</p>
                ))}
            </div>
        </div>
    );
};

const UpgradeButton = ({ onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
        {children}
    </button>
);

const UpgradesPanel = ({ gold, upgrades, onUpgrade }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Mejoras</h2>
        <div className="space-y-4">
            <UpgradeButton onClick={() => onUpgrade('damage')} disabled={gold < upgrades.damage.cost}>
                Aumentar Daño (+{upgrades.damage.increase})
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.damage.cost} Oro</span>
            </UpgradeButton>
            <UpgradeButton onClick={() => onUpgrade('health')} disabled={gold < upgrades.health.cost}>
                Aumentar Salud (+{upgrades.health.increase})
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.health.cost} Oro</span>
            </UpgradeButton>
            <UpgradeButton onClick={() => onUpgrade('critChance')} disabled={gold < upgrades.critChance.cost}>
                Prob. Crítico (+1%)
                <br />
                <span className="text-sm font-normal">Costo: {upgrades.critChance.cost} Oro</span>
            </UpgradeButton>
        </div>
    </div>
);

const SkillButton = ({ skill, onClick }) => {
    const onCooldown = skill.remaining > 0;
    const cooldownPercentage = (skill.cooldown - skill.remaining) / skill.cooldown * 100;

    return (
        <button
            onClick={onClick}
            disabled={onCooldown}
            className="relative w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed overflow-hidden"
        >
            {onCooldown && (
                <div
                    className="absolute top-0 left-0 h-full bg-purple-900 opacity-75"
                    style={{ width: `${cooldownPercentage}%` }}
                ></div>
            )}
            <span className="relative z-10">
                {skill.name}
                <br />
                <span className="text-sm font-normal">{onCooldown ? `${skill.remaining}s` : skill.description}</span>
            </span>
        </button>
    );
};

const SkillsPanel = ({ skills, onUseSkill }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Habilidades</h2>
        <div className="space-y-4">
            <SkillButton skill={skills.powerfulStrike} onClick={() => onUseSkill('powerfulStrike')} />
            <SkillButton skill={skills.quickHeal} onClick={() => onUseSkill('quickHeal')} />
            <SkillButton skill={skills.goldRush} onClick={() => onUseSkill('goldRush')} />
        </div>
    </div>
);

const ItemCard = ({ item, onClick, buttonText }) => {
    if (!item) {
        return <div className="bg-gray-700 p-2 rounded-lg text-center text-gray-400 h-24 flex items-center justify-center">Vacío</div>;
    }
    const rarity = ITEM_RARITIES[item.rarity];
    return (
        <div className={`bg-gray-700 p-2 rounded-lg border ${rarity.color.replace('text-', 'border-').slice(0, -4)}-500`}>
            <p className={`font-bold ${rarity.color}`}>{item.icon} {item.name}</p>
            <p className="text-sm">+ {item.stat === 'critChance' ? (item.value * 100).toFixed(1) + '%' : item.value.toFixed(0)} {item.stat === 'maxHp' ? 'HP' : item.stat === 'damage' ? 'Daño' : 'Crit'}</p>
            {onClick && <button onClick={onClick} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-xs py-1 rounded">{buttonText}</button>}
        </div>
    );
};

const InventoryPanel = ({ equipment, inventory, onEquip, onUnequip }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Equipamiento</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
            <ItemCard item={equipment.weapon} onClick={equipment.weapon ? () => onUnequip('weapon') : null} buttonText="Quitar" />
            <ItemCard item={equipment.shield} onClick={equipment.shield ? () => onUnequip('shield') : null} buttonText="Quitar" />
            <ItemCard item={equipment.amulet} onClick={equipment.amulet ? () => onUnequip('amulet') : null} buttonText="Quitar" />
        </div>
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Inventario ({inventory.length})</h2>
        <div className="grid grid-cols-4 gap-2 h-48 overflow-y-auto">
            {inventory.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => onEquip(item.id)} buttonText="Equipar" />
            ))}
        </div>
    </div>
);

const PrestigePanel = ({ hero, prestige, onPrestige }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Prestigio</h2>
        <p className="text-center">Reliquias: <span className="font-bold text-yellow-300">{prestige.relics}</span></p>
        <p className="text-center text-sm mb-4">Nivel Requerido: {prestige.nextLevelReq}</p>
        <button
            onClick={onPrestige}
            disabled={hero.level < prestige.nextLevelReq}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            Renacer
        </button>
    </div>
);

const PrestigeUpgradesPanel = ({ relics, upgrades, onUpgrade }) => (
     <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full">
        <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Mejoras de Reliquia</h2>
        <div className="space-y-4">
            {Object.entries(upgrades).map(([key, upgrade]) => (
                 <button
                    key={key}
                    onClick={() => onUpgrade(key)}
                    disabled={relics < upgrade.cost}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                 >
                     {upgrade.name} (Nvl {upgrade.level})
                     <br />
                     <span className="text-sm font-normal">{upgrade.description}</span>
                     <br/>
                     <span className="text-sm font-normal">Costo: {upgrade.cost} Reliquias</span>
                 </button>
            ))}
        </div>
    </div>
);

const OfflineGainsModal = ({ gains, onClose }) => {
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-yellow-400">¡Bienvenido de vuelta!</h2>
                <p className="mb-2">Mientras estabas fuera ({formatTime(gains.time)}), tu héroe ha conseguido:</p>
                <p className="text-xl font-semibold text-yellow-300">{gains.gold} Oro</p>
                <p className="text-xl font-semibold text-blue-400">{gains.xp} XP</p>
                {gains.levels > 0 && <p className="text-lg mt-2 text-green-400">¡Y subió {gains.levels} nivel(es)!</p>}
                <button onClick={onClose} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
                    Recoger
                </button>
            </div>
        </div>
    );
};

const FloatingText = ({ text, x, y, color, id }) => {
    const style = {
        left: `${x}px`,
        top: `${y}px`,
        color: color,
    };
    return (
        <div style={style} className="floating-text absolute font-bold text-xl pointer-events-none animate-floatUp">
            {text}
        </div>
    );
};

// --- Componente Principal de la App ---
export default function App() {
    const [gameState, setGameState] = useState(initialGameState);
    const [offlineGains, setOfflineGains] = useState(null);

    const totalStats = useMemo(() => {
        const prestigeDamageBonus = 1 + (gameState.prestigeUpgrades.damageBonus.level * gameState.prestigeUpgrades.damageBonus.increase);
        const stats = {
            damage: gameState.hero.damage * prestigeDamageBonus,
            maxHp: gameState.hero.maxHp,
            critChance: gameState.hero.critChance,
        };
        for (const slot in gameState.hero.equipment) {
            const item = gameState.hero.equipment[slot];
            if (item) {
                stats[item.stat] += item.value;
            }
        }
        return stats;
    }, [gameState.hero, gameState.prestigeUpgrades]);


    const addLogMessage = useCallback((text, color) => {
        setGameState(prev => ({
            ...prev,
            combatLog: [...prev.combatLog.slice(-10), { text, color }],
        }));
    }, []);

    const createFloatingText = useCallback((text, color, customYOffset = 0) => {
        const container = document.getElementById('monster-art-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 50;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 30 + customYOffset;
        const id = Date.now() + Math.random();

        setGameState(prev => ({
            ...prev,
            floatingTexts: [...prev.floatingTexts, { id, text, x, y, color }],
        }));

        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                floatingTexts: prev.floatingTexts.filter(ft => ft.id !== id),
            }));
        }, 1000);
    }, []);

    const generateLoot = useCallback((stage, isBoss = false) => {
        const dropChance = isBoss ? 0.8 : 0.2;
        if (Math.random() > dropChance) return null;

        const rarityRoll = Math.random();
        let rarity;
        if (isBoss) {
            if (rarityRoll < 0.2) rarity = 'epic';
            else if (rarityRoll < 0.6) rarity = 'rare';
            else rarity = 'common';
        } else {
            if (rarityRoll < 0.05) rarity = 'epic';
            else if (rarityRoll < 0.25) rarity = 'rare';
            else rarity = 'common';
        }

        const itemTypes = Object.keys(ITEM_TEMPLATES);
        const itemTypeKey = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const template = ITEM_TEMPLATES[itemTypeKey];
        const value = template.baseValue * ITEM_RARITIES[rarity].multiplier * (1 + (stage - 1) * 0.1);

        return {
            id: Date.now() + Math.random(),
            name: `${template.name} ${ITEM_RARITIES[rarity].name}`,
            icon: template.icon,
            type: itemTypeKey,
            stat: template.stat,
            value: value,
            rarity: rarity,
        };
    }, []);

    const spawnBoss = useCallback(() => {
        setGameState(prev => {
            const stageMultiplier = 1 + (prev.stage - 1) * 0.2;
            const bossNames = ["Rey Goblin", "Señor Esqueleto", "Limo Primordial", "Líder de la Manada", "Madre Araña"];
            const boss = {
                name: `${bossNames[Math.floor(Math.random() * bossNames.length)]} (JEFE)`,
                maxHp: Math.round(50 * stageMultiplier * 10),
                hp: Math.round(50 * stageMultiplier * 10),
                goldReward: Math.round(5 * stageMultiplier * 15),
                xpReward: Math.round(10 * stageMultiplier * 15),
                art: prev.bossArt[Math.floor(Math.random() * prev.bossArt.length)],
            };
            addLogMessage(`¡Un JEFE ha aparecido: ${boss.name}!`, 'text-yellow-400 font-bold');
            return { ...prev, monster: boss, isBossFight: true, bossTimer: 30 };
        });
    }, [addLogMessage]);

    const spawnNewMonster = useCallback(() => {
        setGameState(prev => {
            const stageMultiplier = 1 + (prev.stage - 1) * 0.2;
            const monsterNames = ["Goblin", "Esqueleto", "Limo", "Lobo", "Araña Gigante", "Golem", "Dragón Joven"];
            
            const newMonster = {
                ...prev.monster,
                name: `${monsterNames[Math.floor(Math.random() * monsterNames.length)]} (Etapa ${prev.stage})`,
                maxHp: Math.round(50 * stageMultiplier * (1 + Math.random() * 0.2)),
                hp: Math.round(50 * stageMultiplier * (1 + Math.random() * 0.2)),
                goldReward: Math.round(5 * stageMultiplier),
                xpReward: Math.round(10 * stageMultiplier),
                art: prev.monsterArt[Math.floor(Math.random() * prev.monsterArt.length)],
            };
            addLogMessage(`Un ${newMonster.name} salvaje apareció!`, 'text-gray-400');
            return { ...prev, monster: newMonster, isBossFight: false };
        });
    }, [addLogMessage]);

    const heroAttack = useCallback(() => {
        setGameState(prev => {
            if (prev.monster.hp <= 0) return prev;

            let damageDealt = totalStats.damage;
            let isCrit = Math.random() < totalStats.critChance;
            
            if (prev.effects.powerfulStrikeActive) {
                damageDealt *= 3;
                addLogMessage(`¡GOLPE PODEROSO! Héroe ataca por ${damageDealt.toFixed(0)} de daño.`, 'text-orange-500 font-bold');
                createFloatingText(damageDealt.toFixed(0), 'orange');
            } else if (isCrit) {
                damageDealt = Math.round(damageDealt * prev.hero.critMultiplier);
                addLogMessage(`¡GOLPE CRÍTICO! Héroe ataca por ${damageDealt} de daño.`, 'text-yellow-400');
                createFloatingText(damageDealt, 'yellow');
            } else {
                addLogMessage(`Héroe ataca por ${damageDealt.toFixed(0)} de daño.`, 'text-green-400');
                createFloatingText(damageDealt.toFixed(0), 'white');
            }

            const newMonsterHp = prev.monster.hp - damageDealt;
            let newState = { 
                ...prev, 
                monster: { ...prev.monster, hp: newMonsterHp },
                effects: { ...prev.effects, powerfulStrikeActive: false }
            };

            if (newMonsterHp <= 0) {
                if (prev.isBossFight) {
                    addLogMessage(`¡JEFE DERROTADO!`, 'text-yellow-400 font-bold text-lg');
                    newState.stage++;
                    newState.monstersKilledInStage = 0;
                    addLogMessage(`¡Has avanzado a la etapa ${newState.stage}!`, 'text-purple-400 font-bold');
                } else {
                    newState.monstersKilledInStage++;
                }

                addLogMessage(`${prev.monster.name} ha sido derrotado!`, 'text-red-500');
                
                const goldBonus = 1 + (prev.prestigeUpgrades.goldBonus.level * prev.prestigeUpgrades.goldBonus.increase);
                let goldGained = Math.round(prev.monster.goldReward * goldBonus);

                if (prev.effects.goldRushActive) {
                    goldGained *= 2;
                    addLogMessage(`¡Lluvia de Oro! Recompensa duplicada.`, 'text-yellow-400 font-bold');
                    newState.effects.goldRushActive = false;
                }

                addLogMessage(`+${goldGained} Oro, +${prev.monster.xpReward} XP`, 'text-yellow-300');
                
                const loot = generateLoot(newState.stage, prev.isBossFight);
                if (loot) {
                    newState.inventory = [...newState.inventory, loot];
                    addLogMessage(`¡Has encontrado ${loot.name}!`, ITEM_RARITIES[loot.rarity].color);
                }

                newState.hero.gold += goldGained;
                let newXp = newState.hero.xp + prev.monster.xpReward;
                let newLevel = newState.hero.level;
                let newXpNeeded = newState.hero.xpNeeded;
                let newMaxHp = newState.hero.maxHp;
                let newDamage = newState.hero.damage;

                while (newXp >= newXpNeeded) {
                    newLevel++;
                    newXp -= newXpNeeded;
                    newXpNeeded = Math.round(newXpNeeded * 1.5);
                    newMaxHp += 20;
                    newDamage += 5;
                    addLogMessage(`¡SUBISTE DE NIVEL! Ahora eres nivel ${newLevel}.`, 'text-blue-400 font-bold');
                }
                
                newState.hero = {
                    ...newState.hero,
                    xp: newXp,
                    level: newLevel,
                    xpNeeded: newXpNeeded,
                    maxHp: newMaxHp,
                    damage: newDamage,
                    hp: totalStats.maxHp, 
                };
            }
            return newState;
        });
    }, [addLogMessage, createFloatingText, generateLoot, totalStats]);
    
    const useSkill = useCallback((skillId) => {
        setGameState(prev => {
            const skill = prev.skills[skillId];
            if (skill.remaining > 0) return prev;

            let newState = { ...prev };
            
            switch (skillId) {
                case 'powerfulStrike':
                    newState.effects.powerfulStrikeActive = true;
                    addLogMessage('¡Preparando un Golpe Poderoso!', 'text-orange-400');
                    break;
                case 'quickHeal':
                    const healAmount = Math.round(totalStats.maxHp * 0.25);
                    newState.hero.hp = Math.min(totalStats.maxHp, prev.hero.hp + healAmount);
                    addLogMessage(`¡Te curas por ${healAmount} HP!`, 'text-teal-400');
                    createFloatingText(`+${healAmount} HP`, 'lightgreen', -30);
                    break;
                case 'goldRush':
                    newState.effects.goldRushActive = true;
                    addLogMessage('¡El próximo monstruo soltará el doble de oro!', 'text-yellow-400');
                    break;
                default:
                    return prev;
            }

            newState.skills[skillId].remaining = newState.skills[skillId].cooldown;
            return newState;
        });
    }, [addLogMessage, createFloatingText, totalStats]);

    const equipItem = useCallback((itemId) => {
        setGameState(prev => {
            const itemToEquip = prev.inventory.find(item => item.id === itemId);
            if (!itemToEquip) return prev;

            const newInventory = prev.inventory.filter(item => item.id !== itemId);
            const currentItem = prev.hero.equipment[itemToEquip.type];
            if (currentItem) {
                newInventory.push(currentItem);
            }

            const newEquipment = { ...prev.hero.equipment, [itemToEquip.type]: itemToEquip };
            return { ...prev, inventory: newInventory, hero: { ...prev.hero, equipment: newEquipment } };
        });
    }, []);

    const unequipItem = useCallback((slot) => {
        setGameState(prev => {
            const itemToUnequip = prev.hero.equipment[slot];
            if (!itemToUnequip) return prev;

            const newInventory = [...prev.inventory, itemToUnequip];
            const newEquipment = { ...prev.hero.equipment, [slot]: null };
            return { ...prev, inventory: newInventory, hero: { ...prev.hero, equipment: newEquipment } };
        });
    }, []);

    const handlePrestige = useCallback(() => {
        setGameState(prev => {
            if (prev.hero.level < prev.prestige.nextLevelReq) return prev;

            const relicsGained = Math.floor(prev.stage / 5) + prev.hero.level;
            addLogMessage(`¡RENACIMIENTO! Has ganado ${relicsGained} reliquias.`, 'text-yellow-200 font-bold text-lg');

            return {
                ...prev,
                hero: { ...initialHeroState },
                inventory: [],
                upgrades: initialGameState.upgrades,
                stage: 1,
                monstersKilledInStage: 0,
                isBossFight: false,
                bossTimer: 30,
                prestige: {
                    level: prev.prestige.level + 1,
                    relics: prev.prestige.relics + relicsGained,
                    nextLevelReq: prev.prestige.nextLevelReq + 10,
                }
            };
        });
    }, [addLogMessage]);

    const handlePrestigeUpgrade = useCallback((upgradeId) => {
        setGameState(prev => {
            const upgrade = prev.prestigeUpgrades[upgradeId];
            if (prev.prestige.relics < upgrade.cost) return prev;

            const newPrestige = { ...prev.prestige, relics: prev.prestige.relics - upgrade.cost };
            const newPrestigeUpgrades = {
                ...prev.prestigeUpgrades,
                [upgradeId]: {
                    ...upgrade,
                    level: upgrade.level + 1,
                    cost: upgrade.cost + (upgrade.level + 1),
                }
            };
            
            return { ...prev, prestige: newPrestige, prestigeUpgrades: newPrestigeUpgrades };
        });
    }, []);

    useEffect(() => {
        const gameInterval = setInterval(() => {
            if (!gameState.isBossFight || gameState.bossTimer > 0) {
                heroAttack();
            }
        }, 1000);
        return () => clearInterval(gameInterval);
    }, [heroAttack, gameState.isBossFight, gameState.bossTimer]);
    
    useEffect(() => {
        const cooldownInterval = setInterval(() => {
            setGameState(prev => {
                const newSkills = { ...prev.skills };
                let changed = false;
                for (const skillId in newSkills) {
                    if (newSkills[skillId].remaining > 0) {
                        newSkills[skillId].remaining--;
                        changed = true;
                    }
                }
                return changed ? { ...prev, skills: newSkills } : prev;
            });
        }, 1000);
        return () => clearInterval(cooldownInterval);
    }, []);

    useEffect(() => {
        if (gameState.monster.hp <= 0) {
            const timeout = setTimeout(() => {
                if (gameState.isBossFight) {
                    spawnNewMonster();
                } else if (gameState.monstersKilledInStage >= gameState.monstersPerStage) {
                    spawnBoss();
                } else {
                    spawnNewMonster();
                }
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [gameState.monster.hp, gameState.monstersKilledInStage, gameState.monstersPerStage, gameState.isBossFight, spawnNewMonster, spawnBoss]);
    
    useEffect(() => {
        if (!gameState.isBossFight) return;

        const timerInterval = setInterval(() => {
            setGameState(prev => {
                if (prev.bossTimer > 0) {
                    return { ...prev, bossTimer: prev.bossTimer - 1 };
                } else {
                    addLogMessage('¡Tiempo agotado! El jefe se ha recuperado.', 'text-red-500 font-bold');
                    const newMonster = { ...prev.monster, hp: prev.monster.maxHp };
                    return { ...prev, monster: newMonster, bossTimer: 30 };
                }
            });
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [gameState.isBossFight, addLogMessage]);

    useEffect(() => {
        const savedStateJSON = localStorage.getItem('idleRpgGameState');
        const lastSaveTime = localStorage.getItem('idleRpgLastSave');

        if (savedStateJSON && lastSaveTime) {
            let loadedState = JSON.parse(savedStateJSON);
            const currentTime = Date.now();
            const offlineSeconds = Math.floor((currentTime - parseInt(lastSaveTime, 10)) / 1000);

            if (offlineSeconds > 10) { 
                const goldBonus = 1 + (loadedState.prestigeUpgrades.goldBonus.level * loadedState.prestigeUpgrades.goldBonus.increase);
                const avgGoldPerKill = Math.round(5 * (1 + (loadedState.stage - 1) * 0.2) * goldBonus);
                const avgXpPerKill = Math.round(10 * (1 + (loadedState.stage - 1) * 0.2));
                const killsPerSecond = 1 / 4; 
                const offlineRate = 0.25; 

                const goldGained = Math.floor(offlineSeconds * killsPerSecond * avgGoldPerKill * offlineRate);
                let xpGained = Math.floor(offlineSeconds * killsPerSecond * avgXpPerKill * offlineRate);
                
                loadedState.hero.gold += goldGained;
                let currentXp = loadedState.hero.xp + xpGained;
                let levelsGained = 0;

                while (currentXp >= loadedState.hero.xpNeeded) {
                    currentXp -= loadedState.hero.xpNeeded;
                    loadedState.hero.level++;
                    levelsGained++;
                    loadedState.hero.xpNeeded = Math.round(loadedState.hero.xpNeeded * 1.5);
                    loadedState.hero.maxHp += 20;
                    loadedState.hero.damage += 5;
                }
                loadedState.hero.xp = currentXp;
                loadedState.hero.hp = loadedState.hero.maxHp;

                setOfflineGains({ gold: goldGained, xp: xpGained, time: offlineSeconds, levels: levelsGained });
            }
            setGameState(loadedState);
        }
    }, []);

    useEffect(() => {
        const saveInterval = setInterval(() => {
            localStorage.setItem('idleRpgGameState', JSON.stringify(gameState));
            localStorage.setItem('idleRpgLastSave', Date.now().toString());
        }, 5000);

        return () => clearInterval(saveInterval);
    }, [gameState]);


    const handleUpgrade = (upgradeType) => {
        setGameState(prev => {
            const upgrade = prev.upgrades[upgradeType];
            if (prev.hero.gold < upgrade.cost) return prev;

            const newHero = { ...prev.hero, gold: prev.hero.gold - upgrade.cost };
            const newUpgrades = { ...prev.upgrades };

            if (upgradeType === 'damage') {
                newHero.damage += upgrade.increase;
                newUpgrades.damage.cost = Math.round(upgrade.cost * 1.15);
            } else if (upgradeType === 'health') {
                newHero.maxHp += upgrade.increase;
                newHero.hp += upgrade.increase;
                newUpgrades.health.cost = Math.round(upgrade.cost * 1.2);
            } else if (upgradeType === 'critChance') {
                newHero.critChance += upgrade.increase;
                newUpgrades.critChance.cost = Math.round(upgrade.cost * 1.5);
            }

            return { ...prev, hero: newHero, upgrades: newUpgrades };
        });
    };
    
    const floatUpAnimation = `@keyframes floatUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-50px); }
    }`;
    const floatingTextStyles = `.floating-text { animation: floatUp 1s ease-out forwards; }`;

    return (
        <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen font-sans">
            <style>{floatUpAnimation}</style>
            <style>{floatingTextStyles}</style>

            {offlineGains && <OfflineGainsModal gains={offlineGains} onClose={() => setOfflineGains(null)} />}

            {gameState.floatingTexts.map(ft => (
                <FloatingText key={ft.id} {...ft} />
            ))}

            <div className="container mx-auto p-4 max-w-7xl w-full">
                <h1 className="text-4xl font-bold text-center mb-6 text-yellow-400">Aventura Idle con React</h1>
                {/* CORREGIDO: Layout de cuadrícula principal simplificado */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Columna Izquierda */}
                    <div className="flex flex-col gap-6">
                       <HeroPanel hero={gameState.hero} stats={totalStats} prestige={gameState.prestige} />
                       <SkillsPanel skills={gameState.skills} onUseSkill={useSkill} />
                       <PrestigePanel hero={gameState.hero} prestige={gameState.prestige} onPrestige={handlePrestige} />
                    </div>
                    {/* Columna Central */}
                    <div className="flex flex-col gap-6">
                       <CombatPanel 
                           monster={gameState.monster} 
                           stage={gameState.stage} 
                           combatLog={gameState.combatLog}
                           isBossFight={gameState.isBossFight}
                           bossTimer={gameState.bossTimer}
                       />
                       <InventoryPanel 
                            equipment={gameState.hero.equipment} 
                            inventory={gameState.inventory} 
                            onEquip={equipItem}
                            onUnequip={unequipItem}
                        />
                    </div>
                    {/* Columna Derecha */}
                    <div className="flex flex-col gap-6">
                        <UpgradesPanel gold={gameState.hero.gold} upgrades={gameState.upgrades} onUpgrade={handleUpgrade} />
                        <PrestigeUpgradesPanel 
                            relics={gameState.prestige.relics}
                            upgrades={gameState.prestigeUpgrades}
                            onUpgrade={handlePrestigeUpgrade}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
