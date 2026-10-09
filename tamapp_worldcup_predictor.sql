-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Oct 09, 2026 at 08:49 PM
-- Server version: 10.6.28-MariaDB
-- PHP Version: 8.4.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tamapp_worldcup_predictor`
--

-- --------------------------------------------------------

--
-- Table structure for table `matches`
--

CREATE TABLE `matches` (
  `id` int(10) UNSIGNED NOT NULL,
  `api_id` int(10) UNSIGNED DEFAULT NULL,
  `home_team_id` int(10) UNSIGNED NOT NULL,
  `away_team_id` int(10) UNSIGNED NOT NULL,
  `stage` varchar(50) DEFAULT NULL,
  `group_name` varchar(20) DEFAULT NULL,
  `matchday` int(11) DEFAULT NULL,
  `utc_date` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'SCHEDULED',
  `score_home` int(11) DEFAULT NULL,
  `score_away` int(11) DEFAULT NULL,
  `venue` varchar(100) DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `matches`
--

INSERT INTO `matches` (`id`, `api_id`, `home_team_id`, `away_team_id`, `stage`, `group_name`, `matchday`, `utc_date`, `status`, `score_home`, `score_away`, `venue`, `synced_at`, `created_at`, `updated_at`) VALUES
(1, 537327, 1, 2, 'GROUP_STAGE', 'GROUP_A', 1, '2026-06-11 19:00:00', 'FINISHED', 2, 0, NULL, '2026-06-23 00:12:04', '2026-06-10 23:41:11', '2026-06-23 00:12:04'),
(2, 537328, 3, 4, 'GROUP_STAGE', 'GROUP_A', 1, '2026-06-12 02:00:00', 'FINISHED', 2, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(3, 537333, 5, 6, 'GROUP_STAGE', 'GROUP_B', 1, '2026-06-12 19:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(4, 537345, 7, 8, 'GROUP_STAGE', 'GROUP_D', 1, '2026-06-13 01:00:00', 'FINISHED', 4, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(5, 537334, 9, 10, 'GROUP_STAGE', 'GROUP_B', 1, '2026-06-13 19:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(6, 537339, 11, 12, 'GROUP_STAGE', 'GROUP_C', 1, '2026-06-13 22:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(7, 537340, 13, 14, 'GROUP_STAGE', 'GROUP_C', 1, '2026-06-14 01:00:00', 'FINISHED', 0, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(8, 537346, 15, 16, 'GROUP_STAGE', 'GROUP_D', 1, '2026-06-14 04:00:00', 'FINISHED', 2, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(9, 537351, 17, 18, 'GROUP_STAGE', 'GROUP_E', 1, '2026-06-14 17:00:00', 'FINISHED', 7, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(10, 537357, 19, 20, 'GROUP_STAGE', 'GROUP_F', 1, '2026-06-14 20:00:00', 'FINISHED', 2, 2, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(11, 537352, 21, 22, 'GROUP_STAGE', 'GROUP_E', 1, '2026-06-14 23:00:00', 'FINISHED', 1, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:11', '2026-06-23 00:12:05'),
(12, 537358, 23, 24, 'GROUP_STAGE', 'GROUP_F', 1, '2026-06-15 02:00:00', 'FINISHED', 5, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(13, 537369, 25, 26, 'GROUP_STAGE', 'GROUP_H', 1, '2026-06-15 16:00:00', 'FINISHED', 0, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(14, 537363, 27, 28, 'GROUP_STAGE', 'GROUP_G', 1, '2026-06-15 19:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(15, 537370, 29, 30, 'GROUP_STAGE', 'GROUP_H', 1, '2026-06-15 22:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(16, 537364, 31, 32, 'GROUP_STAGE', 'GROUP_G', 1, '2026-06-16 01:00:00', 'FINISHED', 2, 2, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(17, 537391, 33, 34, 'GROUP_STAGE', 'GROUP_I', 1, '2026-06-16 19:00:00', 'FINISHED', 3, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(18, 537392, 35, 36, 'GROUP_STAGE', 'GROUP_I', 1, '2026-06-16 22:00:00', 'FINISHED', 1, 4, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(19, 537397, 37, 38, 'GROUP_STAGE', 'GROUP_J', 1, '2026-06-17 01:00:00', 'FINISHED', 3, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(20, 537398, 39, 40, 'GROUP_STAGE', 'GROUP_J', 1, '2026-06-17 04:00:00', 'FINISHED', 3, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(21, 537403, 41, 42, 'GROUP_STAGE', 'GROUP_K', 1, '2026-06-17 17:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(22, 537409, 43, 44, 'GROUP_STAGE', 'GROUP_L', 1, '2026-06-17 20:00:00', 'FINISHED', 4, 2, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(23, 537410, 45, 46, 'GROUP_STAGE', 'GROUP_L', 1, '2026-06-17 23:00:00', 'FINISHED', 1, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(24, 537404, 47, 48, 'GROUP_STAGE', 'GROUP_K', 1, '2026-06-18 02:00:00', 'FINISHED', 1, 3, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(25, 537329, 4, 2, 'GROUP_STAGE', 'GROUP_A', 2, '2026-06-18 16:00:00', 'FINISHED', 1, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(26, 537335, 10, 6, 'GROUP_STAGE', 'GROUP_B', 2, '2026-06-18 19:00:00', 'FINISHED', 4, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(27, 537336, 5, 9, 'GROUP_STAGE', 'GROUP_B', 2, '2026-06-18 22:00:00', 'FINISHED', 6, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(28, 537330, 1, 3, 'GROUP_STAGE', 'GROUP_A', 2, '2026-06-19 01:00:00', 'FINISHED', 1, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(29, 537348, 7, 15, 'GROUP_STAGE', 'GROUP_D', 2, '2026-06-19 19:00:00', 'FINISHED', 2, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(30, 537342, 14, 12, 'GROUP_STAGE', 'GROUP_C', 2, '2026-06-19 22:00:00', 'FINISHED', 0, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(31, 537341, 11, 13, 'GROUP_STAGE', 'GROUP_C', 2, '2026-06-20 00:30:00', 'FINISHED', 3, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(32, 537347, 16, 8, 'GROUP_STAGE', 'GROUP_D', 2, '2026-06-20 03:00:00', 'FINISHED', 0, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(33, 537359, 19, 23, 'GROUP_STAGE', 'GROUP_F', 2, '2026-06-20 17:00:00', 'FINISHED', 5, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(34, 537353, 17, 21, 'GROUP_STAGE', 'GROUP_E', 2, '2026-06-20 20:00:00', 'FINISHED', 2, 1, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(35, 537354, 22, 18, 'GROUP_STAGE', 'GROUP_E', 2, '2026-06-21 00:00:00', 'FINISHED', 0, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(36, 537360, 24, 20, 'GROUP_STAGE', 'GROUP_F', 2, '2026-06-21 04:00:00', 'FINISHED', 0, 4, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(37, 537371, 25, 29, 'GROUP_STAGE', 'GROUP_H', 2, '2026-06-21 16:00:00', 'FINISHED', 4, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(38, 537365, 27, 31, 'GROUP_STAGE', 'GROUP_G', 2, '2026-06-21 19:00:00', 'FINISHED', 0, 0, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(39, 537372, 30, 26, 'GROUP_STAGE', 'GROUP_H', 2, '2026-06-21 22:00:00', 'FINISHED', 2, 2, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(40, 537366, 32, 28, 'GROUP_STAGE', 'GROUP_G', 2, '2026-06-22 01:00:00', 'FINISHED', 1, 3, NULL, '2026-06-23 00:12:05', '2026-06-10 23:41:12', '2026-06-23 00:12:05'),
(41, 537399, 37, 39, 'GROUP_STAGE', 'GROUP_J', 2, '2026-06-22 17:00:00', 'FINISHED', 2, 0, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(42, 537393, 33, 35, 'GROUP_STAGE', 'GROUP_I', 2, '2026-06-22 21:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(43, 537394, 36, 34, 'GROUP_STAGE', 'GROUP_I', 2, '2026-06-23 00:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(44, 537400, 40, 38, 'GROUP_STAGE', 'GROUP_J', 2, '2026-06-23 03:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(45, 537405, 41, 47, 'GROUP_STAGE', 'GROUP_K', 2, '2026-06-23 17:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(46, 537411, 43, 45, 'GROUP_STAGE', 'GROUP_L', 2, '2026-06-23 20:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(47, 537412, 46, 44, 'GROUP_STAGE', 'GROUP_L', 2, '2026-06-23 23:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(48, 537406, 48, 42, 'GROUP_STAGE', 'GROUP_K', 2, '2026-06-24 02:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(49, 537337, 10, 5, 'GROUP_STAGE', 'GROUP_B', 3, '2026-06-24 19:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(50, 537338, 6, 9, 'GROUP_STAGE', 'GROUP_B', 3, '2026-06-24 19:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(51, 537344, 12, 13, 'GROUP_STAGE', 'GROUP_C', 3, '2026-06-24 22:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(52, 537343, 14, 11, 'GROUP_STAGE', 'GROUP_C', 3, '2026-06-24 22:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(53, 537331, 4, 1, 'GROUP_STAGE', 'GROUP_A', 3, '2026-06-25 01:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(54, 537332, 2, 3, 'GROUP_STAGE', 'GROUP_A', 3, '2026-06-25 01:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:12', '2026-06-23 00:12:06'),
(55, 537355, 22, 17, 'GROUP_STAGE', 'GROUP_E', 3, '2026-06-25 20:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(56, 537356, 18, 21, 'GROUP_STAGE', 'GROUP_E', 3, '2026-06-25 20:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(57, 537361, 24, 19, 'GROUP_STAGE', 'GROUP_F', 3, '2026-06-25 23:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(58, 537362, 20, 23, 'GROUP_STAGE', 'GROUP_F', 3, '2026-06-25 23:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(59, 537349, 16, 7, 'GROUP_STAGE', 'GROUP_D', 3, '2026-06-26 02:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(60, 537350, 8, 15, 'GROUP_STAGE', 'GROUP_D', 3, '2026-06-26 02:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(61, 537395, 36, 33, 'GROUP_STAGE', 'GROUP_I', 3, '2026-06-26 19:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(62, 537396, 34, 35, 'GROUP_STAGE', 'GROUP_I', 3, '2026-06-26 19:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(63, 537373, 30, 25, 'GROUP_STAGE', 'GROUP_H', 3, '2026-06-27 00:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(64, 537374, 26, 29, 'GROUP_STAGE', 'GROUP_H', 3, '2026-06-27 00:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(65, 537367, 32, 27, 'GROUP_STAGE', 'GROUP_G', 3, '2026-06-27 03:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(66, 537368, 28, 31, 'GROUP_STAGE', 'GROUP_G', 3, '2026-06-27 03:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(67, 537413, 46, 43, 'GROUP_STAGE', 'GROUP_L', 3, '2026-06-27 21:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(68, 537414, 44, 45, 'GROUP_STAGE', 'GROUP_L', 3, '2026-06-27 21:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(69, 537407, 48, 41, 'GROUP_STAGE', 'GROUP_K', 3, '2026-06-27 23:30:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(70, 537408, 42, 47, 'GROUP_STAGE', 'GROUP_K', 3, '2026-06-27 23:30:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(71, 537401, 40, 37, 'GROUP_STAGE', 'GROUP_J', 3, '2026-06-28 02:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06'),
(72, 537402, 38, 39, 'GROUP_STAGE', 'GROUP_J', 3, '2026-06-28 02:00:00', 'TIMED', NULL, NULL, NULL, '2026-06-23 00:12:06', '2026-06-10 23:41:13', '2026-06-23 00:12:06');

-- --------------------------------------------------------

--
-- Table structure for table `predictions`
--

CREATE TABLE `predictions` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `match_id` int(10) UNSIGNED NOT NULL,
  `pred_home` tinyint(3) UNSIGNED NOT NULL,
  `pred_away` tinyint(3) UNSIGNED NOT NULL,
  `points` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `result_status` enum('pending','exact','correct_outcome','close','wrong') NOT NULL DEFAULT 'pending',
  `locked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `predictions`
--

INSERT INTO `predictions` (`id`, `user_id`, `match_id`, `pred_home`, `pred_away`, `points`, `result_status`, `locked_at`, `created_at`, `updated_at`) VALUES
(2, 12, 3, 1, 1, 0, 'pending', NULL, '2026-06-12 20:54:29', '2026-06-13 22:05:56'),
(3, 12, 4, 4, 1, 0, 'pending', NULL, '2026-06-12 20:55:22', '2026-06-13 22:05:45');

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

CREATE TABLE `rankings` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `total_points` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `exact_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `correct_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `close_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `wrong_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `prediction_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rankings`
--

INSERT INTO `rankings` (`id`, `user_id`, `total_points`, `exact_count`, `correct_count`, `close_count`, `wrong_count`, `prediction_count`, `updated_at`) VALUES
(2, 12, 0, 0, 0, 0, 0, 0, '2026-06-12 19:54:14');

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `created_at`) VALUES
(5, 12, '38a26fce8db7d1bc879639d7e6e247d49d8a77ec4197f8b57c71d3a902f86703', '2026-07-12 17:05:30', '2026-06-12 20:35:30'),
(6, 12, '1c104c4974ed0bab008dd2ce4ac458f0ed7092bd09a57d74fb3d277fec4ac06a', '2026-07-19 08:08:24', '2026-06-19 11:38:24'),
(7, 12, '0bffc6cb19920e31127c325eb533b4b8cdddf1dce0cdfa259ba8b76fe2b5f551', '2026-07-22 20:06:12', '2026-06-22 23:36:12');

-- --------------------------------------------------------

--
-- Table structure for table `sync_logs`
--

CREATE TABLE `sync_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `triggered_by` varchar(50) DEFAULT NULL,
  `status` enum('success','failure') NOT NULL,
  `matches_synced` int(11) NOT NULL DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sync_logs`
--

INSERT INTO `sync_logs` (`id`, `triggered_by`, `status`, `matches_synced`, `error_message`, `created_at`) VALUES
(1, 'manual', 'success', 0, NULL, '2026-06-10 23:37:27'),
(2, 'manual', 'success', 72, NULL, '2026-06-10 23:41:13'),
(3, 'manual', 'success', 72, NULL, '2026-06-12 13:44:59'),
(4, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-13 22:34:00'),
(5, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-13 22:39:08'),
(6, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-13 22:42:45'),
(7, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-14 09:07:07'),
(8, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-17 03:20:02'),
(9, 'manual', 'failure', 0, 'request to https://api.football-data.org/v4/competitions/WC/matches failed, reason: connect ETIMEDOUT 45.142.177.98:443', '2026-06-17 03:20:14'),
(10, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4/competitions/WC/matches failed, reason: read ETIMEDOUT', '2026-06-17 04:38:40'),
(11, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4//competitions/WC/matches failed, reason: read ETIMEDOUT', '2026-06-17 10:34:33'),
(12, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4//competitions/WC/matches failed, reason: read ETIMEDOUT', '2026-06-17 10:47:10'),
(13, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4/competitions/wc/matches failed, reason: read ETIMEDOUT', '2026-06-17 11:18:39'),
(14, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4/competitions/wc/matches failed, reason: read ETIMEDOUT', '2026-06-17 11:23:13'),
(15, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4/competitions/wc/matches failed, reason: read ETIMEDOUT', '2026-06-17 11:23:25'),
(16, 'manual', 'failure', 0, 'request to https://odd-sea-d331.rezasoltani09010.workers.dev/v4/competitions/PL/matches failed, reason: read ETIMEDOUT', '2026-06-17 16:02:34');

-- --------------------------------------------------------

--
-- Table structure for table `teams`
--

CREATE TABLE `teams` (
  `id` int(10) UNSIGNED NOT NULL,
  `api_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `short_name` varchar(50) DEFAULT NULL,
  `tla` varchar(10) DEFAULT NULL,
  `crest_url` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teams`
--

INSERT INTO `teams` (`id`, `api_id`, `name`, `short_name`, `tla`, `crest_url`, `created_at`, `updated_at`) VALUES
(1, 1, 'برزیل', 'BRA', 'BRA', 'https://crests.football-data.org/764.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(2, 2, 'آرژانتین', 'ARG', 'ARG', 'https://crests.football-data.org/762.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(3, 3, 'فرانسه', 'FRA', 'FRA', 'https://crests.football-data.org/773.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(4, 4, 'اسپانیا', 'ESP', 'ESP', 'https://crests.football-data.org/760.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(5, 5, 'آلمان', 'GER', 'GER', 'https://crests.football-data.org/759.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(6, 6, 'انگلستان', 'ENG', 'ENG', 'https://crests.football-data.org/770.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(7, 7, 'پرتغال', 'POR', 'POR', 'https://crests.football-data.org/765.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(8, 8, 'ایران', 'IRN', 'IRN', 'https://crests.football-data.org/IRN.svg', '2026-06-10 22:37:13', '2026-06-10 22:37:13'),
(17, 769, 'Mexico', 'Mexico', 'MEX', 'https://crests.football-data.org/769.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(18, 774, 'South Africa', 'South Africa', 'RSA', 'https://crests.football-data.org/9396.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(19, 772, 'South Korea', 'Korea Republic', 'KOR', 'https://crests.football-data.org/772.png', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(20, 798, 'Czechia', 'Czechia', 'CZE', 'https://crests.football-data.org/798.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(21, 828, 'Canada', 'Canada', 'CAN', 'https://crests.football-data.org/canada.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(22, 1060, 'Bosnia-Herzegovina', 'Bosnia-H.', 'BIH', 'https://crests.football-data.org/bosnia.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(23, 771, 'United States', 'USA', 'USA', 'https://crests.football-data.org/usa.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(24, 761, 'Paraguay', 'Paraguay', 'PAR', 'https://crests.football-data.org/761.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(25, 8030, 'Qatar', 'Qatar', 'QAT', 'https://crests.football-data.org/8030.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(26, 788, 'Switzerland', 'Switzerland', 'SUI', 'https://crests.football-data.org/788.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(27, 764, 'Brazil', 'Brazil', 'BRA', 'https://crests.football-data.org/764.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(28, 815, 'Morocco', 'Morocco', 'MAR', 'https://crests.football-data.org/morocco.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(29, 836, 'Haiti', 'Haiti', 'HAI', 'https://crests.football-data.org/haiti.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(30, 8873, 'Scotland', 'Scotland', 'SCO', 'https://crests.football-data.org/814.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(31, 779, 'Australia', 'Australia', 'AUS', 'https://crests.football-data.org/779.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(32, 803, 'Turkey', 'Turkey', 'TUR', 'https://crests.football-data.org/803.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(33, 759, 'Germany', 'Germany', 'GER', 'https://crests.football-data.org/759.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(34, 9460, 'Curaçao', 'Curaçao', 'CUW', 'https://crests.football-data.org/curacao.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(35, 8601, 'Netherlands', 'Netherlands', 'NED', 'https://crests.football-data.org/8601.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(36, 766, 'Japan', 'Japan', 'JPN', 'https://crests.football-data.org/766.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(37, 1935, 'Ivory Coast', 'Ivory Coast', 'CIV', 'https://crests.football-data.org/787.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(38, 791, 'Ecuador', 'Ecuador', 'ECU', 'https://crests.football-data.org/791.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(39, 792, 'Sweden', 'Sweden', 'SWE', 'https://crests.football-data.org/792.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(40, 802, 'Tunisia', 'Tunisia', 'TUN', 'https://crests.football-data.org/tunisia.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(41, 760, 'Spain', 'Spain', 'ESP', 'https://crests.football-data.org/760.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(42, 1930, 'Cape Verde Islands', 'Cape Verde', 'CPV', 'https://crests.football-data.org/cape_verde.svg', '2026-06-10 23:37:25', '2026-06-10 23:37:25'),
(43, 805, 'Belgium', 'Belgium', 'BEL', 'https://crests.football-data.org/805.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(44, 825, 'Egypt', 'Egypt', 'EGY', 'https://crests.football-data.org/825.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(45, 801, 'Saudi Arabia', 'Saudi Arabia', 'KSA', 'https://crests.football-data.org/saudi_arabia.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(46, 758, 'Uruguay', 'Uruguay', 'URY', 'https://crests.football-data.org/758.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(47, 840, 'Iran', 'Iran', 'IRN', 'https://crests.football-data.org/iran.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(48, 783, 'New Zealand', 'New Zealand', 'NZL', 'https://crests.football-data.org/783.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(49, 773, 'France', 'France', 'FRA', 'https://crests.football-data.org/773.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(50, 804, 'Senegal', 'Senegal', 'SEN', 'https://crests.football-data.org/senegal.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(51, 8062, 'Iraq', 'Iraq', 'IRQ', 'https://crests.football-data.org/iraq.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(52, 8872, 'Norway', 'Norway', 'NOR', 'https://crests.football-data.org/813.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(53, 762, 'Argentina', 'Argentina', 'ARG', 'https://crests.football-data.org/762.png', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(54, 778, 'Algeria', 'Algeria', 'ALG', 'https://crests.football-data.org/algeria.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(55, 816, 'Austria', 'Austria', 'AUT', 'https://crests.football-data.org/816.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(56, 8049, 'Jordan', 'Jordan', 'JOR', 'https://crests.football-data.org/8049.png', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(57, 765, 'Portugal', 'Portugal', 'POR', 'https://crests.football-data.org/765.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(58, 1934, 'Congo DR', 'Congo DR', 'COD', 'https://crests.football-data.org/congo_dr.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(59, 770, 'England', 'England', 'ENG', 'https://crests.football-data.org/770.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(60, 799, 'Croatia', 'Croatia', 'CRO', 'https://crests.football-data.org/799.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(61, 763, 'Ghana', 'Ghana', 'GHA', 'https://crests.football-data.org/ghana.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(62, 1836, 'Panama', 'Panama', 'PAN', 'https://crests.football-data.org/panama.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(63, 8070, 'Uzbekistan', 'Uzbekistan', 'UZB', 'https://crests.football-data.org/8070.png', '2026-06-10 23:37:26', '2026-06-10 23:37:26'),
(64, 818, 'Colombia', 'Colombia', 'COL', 'https://crests.football-data.org/818.svg', '2026-06-10 23:37:26', '2026-06-10 23:37:26');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `phone` varchar(15) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(80) DEFAULT NULL,
  `avatar` varchar(100) DEFAULT 'avatar_1',
  `favorite_team` varchar(100) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `notify_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `phone`, `password_hash`, `display_name`, `avatar`, `favorite_team`, `role`, `notify_enabled`, `is_deleted`, `created_at`, `updated_at`) VALUES
(1, '09100000000', '$2a$12$V48RYqeJViACbNWOdX1uWu8xaheP5uNtxlmsS2X2sPEromlQad80a', 'مدیر سیستم', 'avatar_1', NULL, 'admin', 1, 0, '2026-06-10 22:37:10', '2026-06-10 22:37:10'),
(12, '09219721032', '$2a$12$DjWqF3t0gE0zMHNppnfequpzkHPaTPppgN72pkPpIiVmZAxOAbhrm', 'ممرضا', 'avatar_7', '', 'user', 1, 0, '2026-06-12 19:54:14', '2026-06-12 20:56:15');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `predictions`
--
ALTER TABLE `predictions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_match` (`user_id`,`match_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_match_id` (`match_id`);

--
-- Indexes for table `rankings`
--
ALTER TABLE `rankings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_hash` (`token_hash`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_token_hash` (`token_hash`);

--
-- Indexes for table `sync_logs`
--
ALTER TABLE `sync_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `teams`
--
ALTER TABLE `teams`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `api_id` (`api_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`),
  ADD KEY `idx_phone` (`phone`),
  ADD KEY `idx_role` (`role`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `predictions`
--
ALTER TABLE `predictions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `rankings`
--
ALTER TABLE `rankings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `sync_logs`
--
ALTER TABLE `sync_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `teams`
--
ALTER TABLE `teams`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `predictions`
--
ALTER TABLE `predictions`
  ADD CONSTRAINT `predictions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `predictions_ibfk_2` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`);

--
-- Constraints for table `rankings`
--
ALTER TABLE `rankings`
  ADD CONSTRAINT `rankings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
