package org.mathplatform;

final class ApiProblem extends RuntimeException {
    final int status;
    final String code;
    ApiProblem(int status, String code) { super(code); this.status = status; this.code = code; }
}
