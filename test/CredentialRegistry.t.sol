// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Test } from "lib/forge-std/src/Test.sol";
import { CredentialRegistry } from "../contracts/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    CredentialRegistry registry;
    address owner = address(this);
    address issuer = address(0xABCD);
    address subject = address(0x1234);
    bytes32 schemaId = keccak256("TestSchema");

    function setUp() public {
        registry = new CredentialRegistry();
        registry.setIssuer(issuer, true);
    }

    // Verifica che un issuer possa emettere un credential valido.
    function testIssueCredential() public {
        vm.prank(issuer);
        uint256 id = registry.issueCredential(subject, schemaId, 0);
        (bool ok, uint256 validId) = registry.hasValidCredential(subject, schemaId);
        assertTrue(ok);
        assertEq(validId, id);
    }

    // Verifica che un indirizzo non issuer non possa emettere credential.
    function testCannotIssueCredentialIfNotIssuer() public {
        vm.expectRevert("Issuer: not allowed");
        registry.issueCredential(subject, schemaId, 0);
    }

    // Verifica che un issuer possa revocare un credential.
    function testRevokeCredential() public {
        vm.prank(issuer);
        uint256 id = registry.issueCredential(subject, schemaId, 0);
        vm.prank(issuer);
        registry.revokeCredential(id);
        (bool ok, ) = registry.hasValidCredential(subject, schemaId);
        assertFalse(ok);
    }

    // Verifica che un indirizzo non issuer o owner non possa revocare un credential.
    function testCannotRevokeCredentialIfNotIssuerOrOwner() public {
        vm.prank(issuer);
        uint256 id = registry.issueCredential(subject, schemaId, 0);
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        vm.expectRevert("not allowed");
        registry.revokeCredential(id);
    }

    // Verifica che isValid ritorni true per un credential valido.
    function testIsValidReturnsFalseForRevoked() public {
        vm.prank(issuer);
        uint256 id = registry.issueCredential(subject, schemaId, 0);
        vm.prank(issuer);
        registry.revokeCredential(id);
        bool valid = registry.isValid(id);
        assertFalse(valid);
    }

    // Verifica che isValid ritorni false per un credential scaduto.
    function testIsValidReturnsFalseForExpired() public {
        vm.prank(issuer);
    uint256 expiresAt = block.timestamp + 1;
    uint256 id = registry.issueCredential(subject, schemaId, uint64(expiresAt));
        vm.warp(block.timestamp + 2);
        bool valid = registry.isValid(id);
        assertFalse(valid);
    }

    // Verifica che listBySubjectSchema ritorni tutti i credential validi per un subject e schema.
    function testListBySubjectSchema() public {
    vm.prank(issuer);
    uint256 id1 = registry.issueCredential(subject, schemaId, 0);
    vm.prank(issuer);
    uint256 id2 = registry.issueCredential(subject, schemaId, 0);
        uint256[] memory ids = registry.listBySubjectSchema(subject, schemaId);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }
}
