import { Share } from 'react-native';

export const exportBreakevenImage = async () => {
  try {
    // Simple text-based sharing for now
    const reportText = `TarTrack Breakeven Report
Generated on ${new Date().toLocaleDateString('en-PH')}

Check your breakeven status in the TarTrack app!`;

    await Share.share({
      message: reportText,
      title: 'Breakeven Report',
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};