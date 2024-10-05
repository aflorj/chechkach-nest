export const determineNextDrawer = (lobbyInfo) => {
  // find the index of the current drawer
  const currentDrawerIndex = lobbyInfo?.players?.findIndex(
    (player) => player?.playerId === lobbyInfo?.gameState?.drawingUser,
  );

  // find all candidates (connected players with lower index)
  let candidates = lobbyInfo?.players?.filter(
    (player, index) => index < currentDrawerIndex && player?.connected,
  );
  if (candidates?.length) {
    return candidates?.[candidates?.length - 1];
  } else {
    return null;
  }
};
