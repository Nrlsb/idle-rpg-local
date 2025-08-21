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
const initialGameState = {
    hero: {
        level: 1,
        hp: 100,
        maxHp: 100,
        damage: 10,
        critChance: 0.05,
        critMultiplier: 1.5,
        gold: 0,
        xp: 0,
        xpNeeded: 100,
        // NUEVO: Espacios para el equipamiento
        equipment: {
            weapon: null,
            shield: null,
            amulet: null,
        },
    },
    // NUEVO: Inventario para guardar los objetos
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
    combatLog: [],
    floatingTexts: [],
};

// --- Componentes de la UI ---

// MODIFICADO: El panel del héroe ahora muestra las estadísticas calculadas
const HeroPanel = ({ hero, stats }) => {
    const xpPercentage = (hero.xp / hero.xpNeeded) * 100;
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Héroe</h2>
            <div className="space-y-3 text-lg">
                <p><strong>Nivel:</strong> {hero.level}</p>
                <p><strong>HP:</strong> {Math.round(hero.hp)} / {stats.maxHp}</p>
                <p><strong>Daño:</strong> {stats.damage}</p>
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

// Panel de Combate (sin cambios)
const CombatPanel = ({ monster, stage, combatLog }) => {
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
                <h2 className="text-2xl font-bold text-center text-red-400">{monster.name}</h2>
                <div id="monster-art-container" className="text-6xl text-center my-4 relative">{monster.art}</div>
                <div className="relative">
                    <div className="w-full bg-gray-700 rounded-full h-6">
                        <div className="bg-red-600 h-6 rounded-full transition-all duration-300" style={{ width: `${hpPercentage}%` }}></div>
                    </div>
                    <p className="absolute inset-0 flex items-center justify-center font-bold">
                        {Math.round(monster.hp)} / {monster.maxHp}
                    </p>
                </div>
                <p className="text-center mt-2"><strong>Etapa:</strong> {stage}</p>
            </div>
            <div ref={logRef} className="w-full h-48 bg-gray-900 rounded-lg mt-4 p-2 overflow-y-auto text-sm">
                {combatLog.map((msg, index) => (
                    <p key={index} className={msg.color}>{msg.text}</p>
                ))}
            </div>
        </div>
    );
};

// Panel de Mejoras (sin cambios)
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

// Componente de botón de habilidad (sin cambios)
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

// Panel de Habilidades (sin cambios)
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

// NUEVO: Componente para mostrar un objeto
const ItemCard = ({ item, onClick, buttonText }) => {
    if (!item) {
        return <div className="bg-gray-700 p-2 rounded-lg text-center text-gray-400 h-24 flex items-center justify-center">Vacío</div>;
    }
    const rarity = ITEM_RARITIES[item.rarity];
    return (
        <div className={`bg-gray-700 p-2 rounded-lg border ${rarity.color.replace('text-', 'border-').slice(0, -4)}-500`}>
            <p className={`font-bold ${rarity.color}`}>{item.icon} {item.name}</p>
            <p className="text-sm">+ {item.value.toFixed(item.stat === 'critChance' ? 2 : 0)} {item.stat === 'maxHp' ? 'HP' : item.stat === 'damage' ? 'Daño' : 'Crit'}</p>
            {onClick && <button onClick={onClick} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-xs py-1 rounded">{buttonText}</button>}
        </div>
    );
};

// NUEVO: Panel de Inventario y Equipamiento
const InventoryPanel = ({ equipment, inventory, onEquip, onUnequip }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg md:col-span-2">
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


// Componente para el texto flotante (sin cambios)
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

    // NUEVO: useMemo para calcular las estadísticas totales del héroe
    const totalStats = useMemo(() => {
        const stats = {
            damage: gameState.hero.damage,
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
    }, [gameState.hero.damage, gameState.hero.maxHp, gameState.hero.critChance, gameState.hero.equipment]);


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

    // NUEVO: Función para generar botín
    const generateLoot = useCallback((stage) => {
        if (Math.random() > 0.2) return null; // 20% de probabilidad de soltar un objeto

        const rarityRoll = Math.random();
        let rarity;
        if (rarityRoll < 0.05) rarity = 'epic';
        else if (rarityRoll < 0.25) rarity = 'rare';
        else rarity = 'common';

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
            return { ...prev, monster: newMonster };
        });
    }, [addLogMessage]);

    const heroAttack = useCallback(() => {
        setGameState(prev => {
            if (prev.monster.hp <= 0) return prev;

            // MODIFICADO: Usa las estadísticas totales para el combate
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
                addLogMessage(`${prev.monster.name} ha sido derrotado!`, 'text-red-500');
                
                let goldGained = prev.monster.goldReward;
                if (prev.effects.goldRushActive) {
                    goldGained *= 2;
                    addLogMessage(`¡Lluvia de Oro! Recompensa duplicada.`, 'text-yellow-400 font-bold');
                    newState.effects.goldRushActive = false;
                }

                addLogMessage(`+${goldGained} Oro, +${prev.monster.xpReward} XP`, 'text-yellow-300');
                
                // NUEVO: Generar y añadir botín
                const loot = generateLoot(newState.stage);
                if (loot) {
                    newState.inventory = [...newState.inventory, loot];
                    addLogMessage(`¡Has encontrado ${loot.name}!`, ITEM_RARITIES[loot.rarity].color);
                }

                newState.hero.gold += goldGained;
                newState.hero.xp += prev.monster.xpReward;
                newState.monstersKilledInStage++;
                
                if (newState.hero.xp >= newState.hero.xpNeeded) {
                    newState.hero.level++;
                    newState.hero.xp -= newState.hero.xpNeeded;
                    newState.hero.xpNeeded = Math.round(newState.hero.xpNeeded * 1.5);
                    newState.hero.maxHp += 20;
                    newState.hero.hp = totalStats.maxHp; // Cura al máximo al subir de nivel
                    newState.hero.damage += 5;
                    addLogMessage(`¡SUBISTE DE NIVEL! Ahora eres nivel ${newState.hero.level}.`, 'text-blue-400 font-bold');
                }

                if (newState.monstersKilledInStage >= newState.monstersPerStage) {
                    newState.stage++;
                    newState.monstersKilledInStage = 0;
                    addLogMessage(`¡Has avanzado a la etapa ${newState.stage}!`, 'text-purple-400 font-bold');
                }
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

    // NUEVO: Funciones para equipar y desequipar objetos
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

    useEffect(() => {
        const gameInterval = setInterval(() => {
            heroAttack();
        }, 1000);
        return () => clearInterval(gameInterval);
    }, [heroAttack]);
    
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
            setTimeout(spawnNewMonster, 500);
        }
    }, [gameState.monster.hp, spawnNewMonster]);

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

            {gameState.floatingTexts.map(ft => (
                <FloatingText key={ft.id} {...ft} />
            ))}

            <div className="container mx-auto p-4 max-w-7xl w-full">
                <h1 className="text-4xl font-bold text-center mb-6 text-yellow-400">Aventura Idle con React</h1>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-6">
                       <HeroPanel hero={gameState.hero} stats={totalStats} />
                       <SkillsPanel skills={gameState.skills} onUseSkill={useSkill} />
                    </div>
                    <div className="md:col-span-2">
                       <CombatPanel monster={gameState.monster} stage={gameState.stage} combatLog={gameState.combatLog} />
                    </div>
                    <div className="flex flex-col gap-6">
                        <UpgradesPanel gold={gameState.hero.gold} upgrades={gameState.upgrades} onUpgrade={handleUpgrade} />
                    </div>
                </div>
                {/* NUEVO: Fila para el inventario */}
                <div className="mt-6">
                    <InventoryPanel 
                        equipment={gameState.hero.equipment} 
                        inventory={gameState.inventory} 
                        onEquip={equipItem}
                        onUnequip={unequipItem}
                    />
                </div>
            </div>
        </div>
    );
}
