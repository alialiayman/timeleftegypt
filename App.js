import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function App() {
	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.container}>
				<Text style={styles.title}>Gatherly Mobile</Text>
				<Text style={styles.subtitle}>
					The current app UI in `src/` is a web build and uses HTML tags such as div.
				</Text>
				<Text style={styles.subtitle}>
					This native shell prevents the iOS runtime crash and gives you a clean starting
					point to build the React Native screens.
				</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#f5f7fb',
	},
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: '#12223a',
		marginBottom: 12,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 24,
		color: '#3b4a60',
		textAlign: 'center',
		marginBottom: 8,
	},
});
