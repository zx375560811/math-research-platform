package org.mathplatform;

import java.util.List;

final class LearningCourses {
    static final List<String> STAGES = List.of("基础入门", "核心理论", "进阶学习");
    static final List<String> ANALYSIS = List.of("数学分析", "高等代数", "复分析", "实分析与测度论", "常微分方程", "泛函分析", "偏微分方程");
    static List<String> forDirection(String direction) { return "analysis".equals(direction) ? ANALYSIS : STAGES; }
    private LearningCourses() {}
}
