import React, { useState, useEffect, useCallback, useRef } from 'react';

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
    },
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
    stage: 1,
    monstersKilledInStage: 0,
    monstersPerStage: 10,
    monsterArt: ['👹', '👺', '👻', '👽', '💀', '🤖', '🎃', '🐲', '🦂', '🦇'],
    combatLog: [],
    floatingTexts: [],
};

// --- Componentes de la UI ---

// Panel del Héroe
const HeroPanel = ({ hero }) => {
    const xpPercentage = (hero.xp / hero.xpNeeded) * 100;
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-center border-b border-gray-700 pb-2">Héroe</h2>
            <div className="space-y-3 text-lg">
                <p><strong>Nivel:</strong> {hero.level}</p>
                <p><strong>HP:</strong> {Math.round(hero.hp)} / {hero.maxHp}</p>
                <p><strong>Daño:</strong> {hero.damage}</p>
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

// Panel de Combate
const CombatPanel = ({ monster, stage, combatLog }) => {
    const hpPercentage = (monster.hp / monster.maxHp) * 100;
    const logRef = useRef(null);

    useEffect(() => {
        // Auto-scroll del log de combate
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [combatLog]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center justify-between">
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
            <div ref={logRef} className="w-full h-32 bg-gray-900 rounded-lg mt-4 p-2 overflow-y-auto text-sm">
                {combatLog.map((msg, index) => (
                    <p key={index} className={msg.color}>{msg.text}</p>
                ))}
            </div>
        </div>
    );
};

// Panel de Mejoras
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

// Componente para el texto flotante
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

    const addLogMessage = useCallback((text, color) => {
        setGameState(prev => ({
            ...prev,
            combatLog: [...prev.combatLog.slice(-10), { text, color }], // Mantener solo los últimos 11 mensajes
        }));
    }, []);

    const createFloatingText = useCallback((text, color) => {
        const container = document.getElementById('monster-art-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 50;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 30;
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

            let damageDealt = prev.hero.damage;
            let isCrit = Math.random() < prev.hero.critChance;
            
            if (isCrit) {
                damageDealt = Math.round(damageDealt * prev.hero.critMultiplier);
                addLogMessage(`¡GOLPE CRÍTICO! Héroe ataca por ${damageDealt} de daño.`, 'text-yellow-400');
                createFloatingText(damageDealt, 'yellow');
            } else {
                addLogMessage(`Héroe ataca por ${damageDealt} de daño.`, 'text-green-400');
                createFloatingText(damageDealt, 'white');
            }

            const newMonsterHp = prev.monster.hp - damageDealt;
            let newState = { ...prev, monster: { ...prev.monster, hp: newMonsterHp } };

            if (newMonsterHp <= 0) {
                addLogMessage(`${prev.monster.name} ha sido derrotado!`, 'text-red-500');
                addLogMessage(`+${prev.monster.goldReward} Oro, +${prev.monster.xpReward} XP`, 'text-yellow-300');
                
                newState.hero.gold += prev.monster.goldReward;
                newState.hero.xp += prev.monster.xpReward;
                newState.monstersKilledInStage++;
                
                // Level Up Check
                if (newState.hero.xp >= newState.hero.xpNeeded) {
                    newState.hero.level++;
                    newState.hero.xp -= newState.hero.xpNeeded;
                    newState.hero.xpNeeded = Math.round(newState.hero.xpNeeded * 1.5);
                    newState.hero.maxHp += 20;
                    newState.hero.hp = newState.hero.maxHp;
                    newState.hero.damage += 5;
                    addLogMessage(`¡SUBISTE DE NIVEL! Ahora eres nivel ${newState.hero.level}.`, 'text-blue-400 font-bold');
                }

                // Stage Advance Check
                if (newState.monstersKilledInStage >= newState.monstersPerStage) {
                    newState.stage++;
                    newState.monstersKilledInStage = 0;
                    addLogMessage(`¡Has avanzado a la etapa ${newState.stage}!`, 'text-purple-400 font-bold');
                }
            }
            return newState;
        });
    }, [addLogMessage, createFloatingText]);

    // Bucle principal del juego
    useEffect(() => {
        const gameInterval = setInterval(() => {
            heroAttack();
        }, 1000);
        return () => clearInterval(gameInterval);
    }, [heroAttack]);

    // Efecto para invocar un nuevo monstruo cuando el actual es derrotado
    useEffect(() => {
        if (gameState.monster.hp <= 0) {
            setTimeout(spawnNewMonster, 500); // Pequeño retraso antes de que aparezca el siguiente
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
    
    // Estilos para el texto flotante
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

            <div className="container mx-auto p-4 max-w-4xl w-full">
                <h1 className="text-4xl font-bold text-center mb-6 text-yellow-400">Aventura Idle con React</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <HeroPanel hero={gameState.hero} />
                    <CombatPanel monster={gameState.monster} stage={gameState.stage} combatLog={gameState.combatLog} />
                    <UpgradesPanel gold={gameState.hero.gold} upgrades={gameState.upgrades} onUpgrade={handleUpgrade} />
                </div>
            </div>
        </div>
    );
}
