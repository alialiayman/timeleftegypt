/**
 * Table Assignment Algorithm
 * This file contains the logic for assigning people to dining tables
 */

/**
 * Assigns users to tables based on current assignments and settings
 * @param {Array} users - Array of user objects
 * @param {Object} settings - Settings object with maxPeoplePerTable, etc.
 * @param {Array} existingTables - Current table assignments
 * @returns {Array} Array of tables with assigned users
 */
export function assignUsersToTables(users, settings, existingTables = []) {
  const { maxPeoplePerTable = 5, considerLocation = false } = settings;
  const tables = [...existingTables];
  
  // Filter users who don't have a table assignment yet
  const assignedUserIds = new Set();
  tables.forEach(table => {
    table.members.forEach(member => assignedUserIds.add(member.id));
  });
  
  const unassignedUsers = users.filter(user => !assignedUserIds.has(user.id));
  
  // If considering location, group users by location first
  if (considerLocation) {
    return assignByLocation(unassignedUsers, tables, maxPeoplePerTable);
  }
  
  // Simple round-robin assignment
  return assignRoundRobin(unassignedUsers, tables, maxPeoplePerTable);
}

/**
 * Simple round-robin assignment to distribute users evenly
 */
function assignRoundRobin(users, tables, maxPeoplePerTable) {
  const result = [...tables];
  
  for (const user of users) {
    // Find table with least members (that's not full)
    let targetTable = null;
    let minMembers = maxPeoplePerTable;
    
    for (const table of result) {
      if (table.members.length < minMembers) {
        targetTable = table;
        minMembers = table.members.length;
      }
    }
    
    // If no existing table has space, create a new one
    if (!targetTable || targetTable.members.length >= maxPeoplePerTable) {
      targetTable = {
        id: `table-${result.length + 1}`,
        name: `Table ${result.length + 1}`,
        members: []
      };
      result.push(targetTable);
    }
    
    // Assign user to table
    targetTable.members.push({
      id: user.id,
      name: user.displayName || user.name,
      fullName: user.fullName,
      photoURL: user.photoURL,
      gender: user.gender,
      preferences: user.preferences
    });
  }
  
  return result;
}

/**
 * Assignment considering geographical location
 */
function assignByLocation(users, tables, maxPeoplePerTable) {
  // Group users by location (simplified - could be more sophisticated)
  const locationGroups = {};
  
  for (const user of users) {
    const locationKey = user.location ? 
      `${Math.round(user.location.latitude * 100)}-${Math.round(user.location.longitude * 100)}` : 
      'unknown';
    
    if (!locationGroups[locationKey]) {
      locationGroups[locationKey] = [];
    }
    locationGroups[locationKey].push(user);
  }
  
  const result = [...tables];
  
  // Assign users from each location group
  for (const [, locationUsers] of Object.entries(locationGroups)) {
    result.push(...assignRoundRobin(locationUsers, [], maxPeoplePerTable));
  }
  
  return result;
}

/**
 * Shuffles existing table assignments to create new configurations
 * @param {Array} tables - Current table assignments
 * @param {Number} maxPeoplePerTable - Maximum people per table
 * @returns {Array} New shuffled table assignments
 */
export function shuffleTables(tables, maxPeoplePerTable = 5) {
  // Collect all users from all tables
  const allUsers = [];
  tables.forEach(table => {
    allUsers.push(...table.members);
  });
  
  // Shuffle the users array
  const shuffledUsers = [...allUsers];
  for (let i = shuffledUsers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
  }
  
  // Redistribute to tables
  const newTables = [];
  for (let i = 0; i < shuffledUsers.length; i += maxPeoplePerTable) {
    const tableMembers = shuffledUsers.slice(i, i + maxPeoplePerTable);
    newTables.push({
      id: `table-${newTables.length + 1}`,
      name: `Table ${newTables.length + 1}`,
      members: tableMembers
    });
  }
  
  return newTables;
}

/**
 * Moves a user from one table to another
 * @param {Array} tables - Current table assignments
 * @param {String} userId - ID of user to move
 * @param {String} fromTableId - Current table ID
 * @param {String} toTableId - Destination table ID
 * @param {Number} maxPeoplePerTable - Maximum people per table
 * @returns {Object} { success: boolean, tables: Array, message: string }
 */
export function moveUserBetweenTables(tables, userId, fromTableId, toTableId, maxPeoplePerTable = 5) {
  const result = tables.map(table => ({ ...table, members: [...table.members] }));
  
  const fromTable = result.find(table => table.id === fromTableId);
  const toTable = result.find(table => table.id === toTableId);
  
  if (!fromTable || !toTable) {
    return { success: false, tables: result, message: "Table not found" };
  }
  
  if (toTable.members.length >= maxPeoplePerTable) {
    return { success: false, tables: result, message: "Destination table is full" };
  }
  
  const userIndex = fromTable.members.findIndex(member => member.id === userId);
  if (userIndex === -1) {
    return { success: false, tables: result, message: "User not found in source table" };
  }
  
  // Move the user
  const user = fromTable.members.splice(userIndex, 1)[0];
  toTable.members.push(user);
  
  return { success: true, tables: result, message: "User moved successfully" };
}

/**
 * Calculates optimal table distribution statistics
 * @param {Number} totalUsers - Total number of users
 * @param {Number} maxPeoplePerTable - Maximum people per table
 * @returns {Object} Statistics about table distribution
 */
export function getTableDistributionStats(totalUsers, maxPeoplePerTable = 5) {
  const minTables = Math.ceil(totalUsers / maxPeoplePerTable);
  const perfectDistribution = Math.floor(totalUsers / minTables);
  const tablesWithExtra = totalUsers % minTables;
  
  return {
    totalTables: minTables,
    averagePeoplePerTable: perfectDistribution,
    tablesWithExtraPerson: tablesWithExtra,
    tablesWithNormalCount: minTables - tablesWithExtra
  };
}