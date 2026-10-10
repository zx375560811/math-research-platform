package org.mathplatform;

import java.util.List;
import java.util.ArrayList;
import java.sql.Connection;
import java.sql.SQLException;

final class LearningCourses {
    static final List<String> STAGES = List.of("基础入门", "核心理论", "进阶学习");
    static final List<String> ANALYSIS = List.of("数学分析", "高等代数", "复分析", "实分析与测度论", "常微分方程", "泛函分析", "偏微分方程");
    static final List<String> FOLDER_ANALYSIS = List.of("分析", "复分析", "测度论", "实分析", "常微分方程", "泛函分析", "偏微分方程");
    static final List<String> FOLDER_ALGEBRA = List.of("高等代数", "抽象代数");
    static List<String> forDirection(String direction) { return "analysis".equals(direction) ? ANALYSIS : STAGES; }
    static List<String> forDirection(Connection db, String direction) throws SQLException {
        var courses = new ArrayList<String>();
        try (var query = db.prepareStatement("SELECT name FROM learning_course_config WHERE direction=? ORDER BY sort_order,name")) {
            query.setString(1,direction); try (var rows = query.executeQuery()) { while (rows.next()) courses.add(rows.getString(1)); }
        }
        if (replacementLibrary(db)) {
            var complete = new ArrayList<String>("analysis".equals(direction) ? FOLDER_ANALYSIS : "algebra".equals(direction) ? FOLDER_ALGEBRA : List.of());
            for (String course : courses) if (!complete.contains(course)) complete.add(course);
            return complete;
        }
        if (courses.isEmpty()) return forDirection(direction);
        // Imported course configurations can predate the ODE course. Keep its
        // entry available even when no corresponding document has been added.
        if ("analysis".equals(direction) && !courses.contains("常微分方程")) {
            int functional = courses.indexOf("泛函分析");
            courses.add(functional < 0 ? courses.size() : functional, "常微分方程");
        }
        return courses;
    }
    static boolean replacementLibrary(Connection db) throws SQLException {
        try (var query = db.createStatement(); var row = query.executeQuery("SELECT 1 FROM library_settings WHERE name='seed_books' AND value='disabled'")) { return row.next(); }
    }
    private LearningCourses() {}
}
